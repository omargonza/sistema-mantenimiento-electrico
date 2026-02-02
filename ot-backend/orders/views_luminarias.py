import re
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from orders.models import OrdenTrabajo

# Detecta códigos tipo: PC4026, CC4105, etc.
# - 2 a 4 letras (ramal/cantero) + 3 a 6 dígitos
CODE_RE = re.compile(r"\b([A-Z]{2,4}\s*-?\s*\d{3,6})\b", re.IGNORECASE)


def parse_luminaria_codes(text: str):
    """
    Extrae códigos de luminaria desde luminaria_equipos (texto libre).
    Devuelve lista única preservando orden.
    Acepta separadores: espacios, coma, punto y coma, saltos de línea,
    y tolera 'PC 4026' o 'PC-4026'.
    """
    if not text:
        return []

    s = str(text).upper()
    found = CODE_RE.findall(s)

    # Normalización: quitar espacios/guiones internos => PC4026
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
    def get(self, request):
        q_from = request.query_params.get("from", "")
        q_to = request.query_params.get("to", "")
        q_ramal = (request.query_params.get("ramal") or "").strip()

        qs = OrdenTrabajo.objects.filter(alcance__iexact="LUMINARIA")

        if q_ramal:
            qs = qs.filter(ramal=q_ramal)
        if q_from:
            qs = qs.filter(fecha__gte=q_from)
        if q_to:
            qs = qs.filter(fecha__lte=q_to)

        # Para mapa: deben tener ramal + km
        qs = qs.exclude(ramal="").exclude(km_luminaria__isnull=True)

        # Acotamos cantidad de OTs consultadas (luego se “explota” en items)
        qs = qs.order_by("-fecha", "-id")[:5000]

        out = []
        for ot in qs:
            # 1) Fuente principal: lista canónica persistida
            codes = []
            if hasattr(ot, "codigos_luminarias") and isinstance(
                ot.codigos_luminarias, list
            ):
                codes = [
                    str(x).strip().upper()
                    for x in ot.codigos_luminarias
                    if str(x).strip()
                ]

            # 2) Fallback: parseo desde texto libre (OTs viejas)
            if not codes:
                codes = parse_luminaria_codes(getattr(ot, "luminaria_equipos", ""))

            # 3) Fallback final: codigo_luminaria único
            if not codes:
                fallback = (ot.codigo_luminaria or "").strip().upper()
                if fallback:
                    codes = [fallback]

            # 4) Si sigue vacío, no aporta al mapa
            if not codes:
                continue

            base = {
                "ot_id": ot.id,
                "id_ot": f"OT-{ot.id:06d}",
                "fecha": ot.fecha.isoformat(),
                "ramal": ot.ramal,
                "km": float(ot.km_luminaria),
                "resultado": (ot.resultado or "").upper(),
                "luminaria_estado": (ot.luminaria_estado or "").upper(),
                "ubicacion": ot.ubicacion or "",
            }

            # 5) Un item por luminaria
            for idx, code in enumerate(codes):
                out.append(
                    {
                        **base,
                        "id": f"{ot.id}-{idx}",  # id único por pin
                        "codigo": code,
                    }
                )

        # Opcional: cap “pins” para no romper performance (ajustable)
        if len(out) > 20000:
            out = out[:20000]

        return Response(out, status=status.HTTP_200_OK)
