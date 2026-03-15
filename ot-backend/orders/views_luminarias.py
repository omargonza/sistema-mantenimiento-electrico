# orders/views_luminarias.py
import re

from django.db.models import Prefetch
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication

from accounts.permissions import IsAdminOrTechnicianRole
from orders.models import (
    OrdenTrabajo,
    OrdenTrabajoLuminariaGrupo,
    OrdenTrabajoLuminariaItem,
)

CODE_RE = re.compile(r"\b([A-Z]{2,4}\s*-?\s*\d{3,6})\b", re.IGNORECASE)


def parse_luminaria_codes(text: str):
    if not text:
        return []

    s = str(text).upper()
    found = CODE_RE.findall(s)

    out = []
    seen = set()
    for raw in found:
        code = re.sub(r"[\s\-]+", "", raw.strip().upper())
        if not code:
            continue
        if code in seen:
            continue
        seen.add(code)
        out.append(code)
    return out


class LuminariasHistorialView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsAdminOrTechnicianRole]

    def get(self, request):
        q_from = request.query_params.get("from", "")
        q_to = request.query_params.get("to", "")
        q_ramal = (request.query_params.get("ramal") or "").strip()

        grupos_qs = (
            OrdenTrabajoLuminariaGrupo.objects.select_related("tablero")
            .prefetch_related(
                Prefetch(
                    "items",
                    queryset=OrdenTrabajoLuminariaItem.objects.all().order_by(
                        "orden", "id"
                    ),
                )
            )
            .order_by("orden", "id")
        )

        if q_ramal:
            grupos_qs = grupos_qs.filter(ramal=q_ramal)

        qs = (
            OrdenTrabajo.objects.filter(alcance__iexact="LUMINARIA")
            .prefetch_related(
                Prefetch(
                    "luminaria_grupos",
                    queryset=grupos_qs,
                )
            )
            .order_by("-fecha", "-id")
        )

        # Historial global compartido para admin y técnicos
        if q_from:
            qs = qs.filter(fecha__gte=q_from)
        if q_to:
            qs = qs.filter(fecha__lte=q_to)

        qs = qs[:5000]

        out = []

        for ot in qs:
            grupos = list(getattr(ot, "luminaria_grupos").all())

            # ============================================
            # 1) MODO NUEVO: grupos + items relacionados
            #    Mostrar TODO, tenga o no tenga KM
            # ============================================
            if grupos:
                for grupo in grupos:
                    items = list(getattr(grupo, "items").all())

                    for idx, item in enumerate(items):
                        code = (item.codigo_luminaria or "").strip().upper()
                        if not code:
                            continue

                        km_value = item.km_luminaria
                        km_out = float(km_value) if km_value is not None else None

                        out.append(
                            {
                                "id": f"{ot.id}-{grupo.id}-{idx}",
                                "ot_id": ot.id,
                                "id_ot": f"OT-{ot.id:06d}",
                                "fecha": ot.fecha.isoformat(),
                                "ramal": grupo.ramal or "",
                                "km": km_out,
                                "resultado": (grupo.resultado or "").upper(),
                                "luminaria_estado": (
                                    grupo.luminaria_estado or ""
                                ).upper(),
                                "ubicacion": ot.ubicacion or "",
                                "codigo": code,
                                "tablero": (
                                    grupo.tablero.nombre if grupo.tablero else ""
                                ),
                                "zona": grupo.zona or "",
                                "circuito": grupo.circuito or "",
                            }
                        )

                continue

            # ============================================
            # 2) MODO VIEJO: OT plana
            #    Mostrar TODO, tenga o no tenga KM
            # ============================================
            if q_ramal and (ot.ramal or "").strip() != q_ramal:
                continue

            codes = []
            if hasattr(ot, "codigos_luminarias") and isinstance(
                ot.codigos_luminarias, list
            ):
                codes = [
                    str(x).strip().upper()
                    for x in ot.codigos_luminarias
                    if str(x).strip()
                ]

            if not codes:
                codes = parse_luminaria_codes(getattr(ot, "luminaria_equipos", ""))

            if not codes:
                fallback = (ot.codigo_luminaria or "").strip().upper()
                if fallback:
                    codes = [fallback]

            if not codes:
                continue

            km_out = float(ot.km_luminaria) if ot.km_luminaria is not None else None

            base = {
                "ot_id": ot.id,
                "id_ot": f"OT-{ot.id:06d}",
                "fecha": ot.fecha.isoformat(),
                "ramal": ot.ramal,
                "km": km_out,
                "resultado": (ot.resultado or "").upper(),
                "luminaria_estado": (ot.luminaria_estado or "").upper(),
                "ubicacion": ot.ubicacion or "",
                "tablero": ot.tablero or "",
                "zona": ot.zona or "",
                "circuito": ot.circuito or "",
            }

            for idx, code in enumerate(codes):
                out.append(
                    {
                        **base,
                        "id": f"{ot.id}-{idx}",
                        "codigo": code,
                    }
                )

        if len(out) > 20000:
            out = out[:20000]

        return Response(out, status=status.HTTP_200_OK)
