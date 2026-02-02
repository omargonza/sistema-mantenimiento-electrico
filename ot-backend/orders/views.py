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

from historial.models import Tablero


# ==========================================================
# Canon / helpers de identidad
# ==========================================================
def _canon_tablero(nombre: str) -> str:
    """
    Canonicaliza para evitar falsos distintos:
    - trim
    - espacios múltiples
    - guiones raros
    """
    s = (nombre or "").strip()
    s = re.sub(r"\s+", " ", s)
    s = s.replace("–", "-").replace("—", "-")
    return s


def _resolve_tablero_catalogo(raw: str):
    """
    NO crea tablero.
    Devuelve:
      (nombre_final, tablero_ok)
    """
    raw = _canon_tablero(raw)
    if not raw:
        return "", False

    t = Tablero.objects.filter(nombre__iexact=raw).only("nombre").first()
    if t:
        return t.nombre, True

    return raw, False


# ==========================================================
# Helpers imágenes / paths
# ==========================================================
def _b64_to_bytes(s: str) -> bytes:
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
    raw = _b64_to_bytes(b64)
    if not raw:
        return ""

    os.makedirs(abs_folder, exist_ok=True)
    path = os.path.join(abs_folder, filename)

    with open(path, "wb") as f:
        f.write(raw)

    return path


def _rel_media_path(abs_path: str) -> str:
    if not abs_path:
        return ""

    rel = os.path.relpath(abs_path, settings.MEDIA_ROOT)
    return rel.replace("\\", "/")


def _safe_filename(s: str) -> str:
    s = (s or "").strip()
    s = s.replace("/", "-").replace("\\", "-")
    s = re.sub(r'[:*"<>|?]', "", s)
    s = re.sub(r"\s+", " ", s)
    return s[:80] or "OT"


# ==========================================================
# API: List + Create (debug / admin)
# ==========================================================
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


# ==========================================================
# API: Generar PDF + Persistir OT
# ==========================================================
class OrdenPDFView(APIView):
    def post(self, request):

        # ------------------------------------------
        # 0) Copia mutable del request (para pop)
        # ------------------------------------------
        request_data = dict(request.data)

        # flag solo informativo (frontend)
        request_data.pop("tablero_catalogado", None)

        serializer = OrdenTrabajoSerializer(data=request_data)
        if not serializer.is_valid():
            print("ERRORES SERIALIZER OT:", serializer.errors)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = dict(serializer.validated_data)

        alcance = (data.get("alcance") or "").strip().upper()

        # Si llega lista, ok. Si no llega, intentar derivarla desde luminaria_equipos (por compat)
        cods = data.get("codigos_luminarias") or []
        if alcance == "LUMINARIA":
            if not cods:
                # fallback desde texto libre (mismo criterio que views_luminarias)
                from .views_luminarias import parse_luminaria_codes

                cods = parse_luminaria_codes(data.get("luminaria_equipos", "")) or []

            # setear lista canónica persistida
            data["codigos_luminarias"] = cods

            # compat: codigo principal (max 30)
            if not (data.get("codigo_luminaria") or "").strip() and cods:
                data["codigo_luminaria"] = cods[0]
            data["codigo_luminaria"] = (data.get("codigo_luminaria") or "")[:30]

        else:
            # por seguridad extra: si no es luminaria, limpiar (aunque serializer ya lo haga)
            data["codigos_luminarias"] = []
            data["codigo_luminaria"] = ""
            data["ramal"] = ""
            data["km_luminaria"] = None
            data["luminaria_equipos"] = ""
            data["luminaria_estado"] = ""

        # ------------------------------------------
        # 1) Normalizar identidad (SIN CREAR TABLERO)
        # ------------------------------------------
        tablero_raw = data.get("tablero")
        tablero_final, tablero_ok = _resolve_tablero_catalogo(tablero_raw)

        data["tablero"] = tablero_final
        data["zona"] = (data.get("zona") or "").strip()
        data["circuito"] = (data.get("circuito") or "").strip()

        # ------------------------------------------
        # 2) Preparar carpetas
        # ------------------------------------------
        ahora = timezone.now()
        year = ahora.strftime("%Y")
        month = ahora.strftime("%m")

        ot_ts = int(ahora.timestamp())
        evidence_rel = os.path.join("ordenes", year, month, f"evid_{ot_ts}")
        evidence_abs = os.path.join(settings.MEDIA_ROOT, evidence_rel)
        os.makedirs(evidence_abs, exist_ok=True)

        # ------------------------------------------
        # 3) Campos SOLO request
        # ------------------------------------------
        firma_b64 = data.pop("firma_tecnico_img", "")
        fotos_b64 = data.pop("fotos_b64", []) or []
        print_mode = bool(data.pop("print_mode", False))

        # ------------------------------------------
        # 4) Guardar firma
        # ------------------------------------------
        firma_rel = ""
        if firma_b64:
            firma_abs = _save_b64_image(
                evidence_abs,
                "firma_tecnico.png",
                firma_b64,
            )
            firma_rel = _rel_media_path(firma_abs)

        # ------------------------------------------
        # 5) Guardar fotos (máx 4)
        # ------------------------------------------
        fotos_rel = []
        for idx, fb64 in enumerate(list(fotos_b64)[:4], start=1):
            p_abs = _save_b64_image(
                evidence_abs,
                f"foto_{idx}.jpg",
                fb64,
            )
            p_rel = _rel_media_path(p_abs)
            if p_rel:
                fotos_rel.append(p_rel)

        # ------------------------------------------
        # 6) Persistir OT (SIEMPRE)
        # ------------------------------------------
        if firma_rel:
            data["firma_tecnico_path"] = firma_rel
        if fotos_rel:
            data["fotos"] = fotos_rel

        ot = OrdenTrabajo.objects.create(**data)

        # ------------------------------------------
        # 7) Preparar data PDF
        # ------------------------------------------
        pdf_data = dict(data)
        pdf_data["print_mode"] = print_mode
        pdf_data["id_ot"] = f"OT-{ot.id:06d}"
        pdf_data["firma_tecnico_path"] = firma_rel
        pdf_data["fotos_paths"] = fotos_rel

        # 🔴 CLAVE: flag REAL para leyenda / watermark
        pdf_data["tablero_catalogado"] = bool(tablero_ok)

        # ------------------------------------------
        # 8) Generar PDF
        # ------------------------------------------
        pdf_bytes = generar_pdf(pdf_data)

        # ------------------------------------------
        # 9) Guardar PDF
        # ------------------------------------------
        pdf_folder = os.path.join(settings.MEDIA_ROOT, "ordenes", year, month)
        os.makedirs(pdf_folder, exist_ok=True)

        fecha = _safe_filename(str(pdf_data.get("fecha", "")))
        tablero = _safe_filename(str(pdf_data.get("tablero") or "OT"))
        filename = f"OT_{fecha}_{tablero}_{ot.id}.pdf"
        filepath = os.path.join(pdf_folder, filename)

        with open(filepath, "wb") as f:
            f.write(pdf_bytes)

        # ------------------------------------------
        # 10) Responder
        # ------------------------------------------
        resp = HttpResponse(pdf_bytes, content_type="application/pdf")
        resp["Content-Disposition"] = f'attachment; filename="{filename}"'
        return resp
