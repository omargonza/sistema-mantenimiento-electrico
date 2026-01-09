# orders/views.py
import os
import re
import base64

from django.conf import settings
from django.utils import timezone
from django.http import HttpResponse

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .models import OrdenTrabajo
from .serializers import OrdenTrabajoSerializer
from .pdf import generar_pdf

from historial.services import registrar_historial_desde_ot


# =========================
# Helpers
# =========================
def _b64_to_bytes(s: str) -> bytes:
    """
    Acepta:
      - data URL: data:image/png;base64,...
      - base64 puro
    """
    s = (s or "").strip()
    if not s:
        return b""

    if s.startswith("data:image/"):
        try:
            _, b64 = s.split(",", 1)
            return base64.b64decode(b64)
        except Exception:
            return b""

    try:
        return base64.b64decode(s)
    except Exception:
        return b""


def _save_b64_image(abs_folder: str, filename: str, b64: str) -> str:
    """Guarda archivo dentro de abs_folder y devuelve path absoluto o "" si falla."""
    raw = _b64_to_bytes(b64)
    if not raw:
        return ""

    os.makedirs(abs_folder, exist_ok=True)
    path = os.path.join(abs_folder, filename)

    with open(path, "wb") as f:
        f.write(raw)

    return path


def _rel_media_path(abs_path: str) -> str:
    """Convierte path absoluto dentro de MEDIA_ROOT a path relativo."""
    if not abs_path:
        return ""

    rel = os.path.relpath(abs_path, settings.MEDIA_ROOT)
    return rel.replace("\\", "/")


def _safe_filename(s: str) -> str:
    """Evita caracteres inválidos y limita longitud."""
    s = (s or "").strip()
    s = s.replace("/", "-").replace("\\", "-")
    s = re.sub(r'[:*"<>|?]', "", s)
    s = re.sub(r"\s+", " ", s)
    return s[:80] or "OT"


# =========================
# API: List + Create
# =========================
class OrdenListCreateView(APIView):
    def get(self, request):
        ordenes = OrdenTrabajo.objects.all().order_by("-id")
        serializer = OrdenTrabajoSerializer(ordenes, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = OrdenTrabajoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ot = serializer.save()
        return Response(
            OrdenTrabajoSerializer(ot).data,
            status=status.HTTP_201_CREATED,
        )


# =========================
# API: Generar PDF + Auditoría + Historial
# =========================
class OrdenPDFView(APIView):
    def post(self, request):
        serializer = OrdenTrabajoSerializer(data=request.data)

        if not serializer.is_valid():
            print("ERRORES SERIALIZER OT:", serializer.errors)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # Copia segura de validated_data
        data = dict(serializer.validated_data)

        ahora = timezone.now()
        year = ahora.strftime("%Y")
        month = ahora.strftime("%m")

        # Carpeta única por OT para evidencias
        ot_ts = int(ahora.timestamp())
        evidence_rel_folder = os.path.join("ordenes", year, month, f"evid_{ot_ts}")
        evidence_abs_folder = os.path.join(settings.MEDIA_ROOT, evidence_rel_folder)
        os.makedirs(evidence_abs_folder, exist_ok=True)

        # =========================
        # 1) Datos SOLO del request
        # =========================
        firma_b64 = data.pop("firma_tecnico_img", "")
        fotos_b64 = data.pop("fotos_b64", []) or []
        print_mode = bool(data.pop("print_mode", False))

        # =========================
        # 2) Guardar firma técnico
        # =========================
        firma_rel = ""
        if firma_b64:
            firma_abs = _save_b64_image(
                evidence_abs_folder,
                "firma_tecnico.png",
                firma_b64,
            )
            firma_rel = _rel_media_path(firma_abs)

        # =========================
        # 3) Guardar fotos (máx 4)
        # =========================
        fotos_rel = []
        for idx, fb64 in enumerate(list(fotos_b64)[:4], start=1):
            p_abs = _save_b64_image(
                evidence_abs_folder,
                f"foto_{idx}.jpg",
                fb64,
            )
            p_rel = _rel_media_path(p_abs)
            if p_rel:
                fotos_rel.append(p_rel)

        # =========================
        # 4) Persistir OT (SIEMPRE)
        # =========================
        if firma_rel:
            data["firma_tecnico_path"] = firma_rel
        if fotos_rel:
            data["fotos"] = fotos_rel

        ot = OrdenTrabajo.objects.create(**data)

        # =========================
        # 4.1) Registrar historial (GLOBAL)
        # =========================
        try:
            registrar_historial_desde_ot(
                {
                    "tablero": ot.tablero,
                    "zona": ot.zona,
                    "circuito": ot.circuito,
                    "tarea_realizada": ot.tarea_realizada,
                    "tarea_pedida": ot.tarea_pedida,
                    "tarea_pendiente": ot.tarea_pendiente,
                    "fecha": ot.fecha,
                }
            )

        except Exception as e:
            # Nunca romper la OT ni el PDF por el historial
            print("ERROR HISTORIAL:", e)

        # =========================
        # 5) Preparar data para PDF
        # =========================
        pdf_data = dict(data)
        pdf_data["print_mode"] = print_mode
        pdf_data["id_ot"] = f"OT-{ot.id:06d}"
        pdf_data["firma_tecnico_path"] = firma_rel
        pdf_data["fotos_paths"] = fotos_rel

        # =========================
        # 6) Generar PDF
        # =========================
        pdf_bytes = generar_pdf(pdf_data)

        # =========================
        # 7) Guardar PDF
        # =========================
        pdf_folder = os.path.join(settings.MEDIA_ROOT, "ordenes", year, month)
        os.makedirs(pdf_folder, exist_ok=True)

        fecha = _safe_filename(str(pdf_data.get("fecha", "")))
        tablero = _safe_filename(str(pdf_data.get("tablero") or "OT"))
        filename = f"OT_{fecha}_{tablero}_{ot.id}.pdf"
        filepath = os.path.join(pdf_folder, filename)

        with open(filepath, "wb") as f:
            f.write(pdf_bytes)

        # =========================
        # 8) Responder PDF
        # =========================
        resp = HttpResponse(pdf_bytes, content_type="application/pdf")
        resp["Content-Disposition"] = f'attachment; filename="{filename}"'
        return resp
