from datetime import date
from django.db.models import Count, Q
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny

from .models import Tablero, HistorialTarea
from .serializers import TableroSerializer


from rest_framework import status

from .models import Tablero


class TablerosListView(APIView):
    """
    Catálogo completo de tableros.
    GET /api/tableros/
    """

    permission_classes = [AllowAny]

    def get(self, request):
        qs = Tablero.objects.all().order_by("zona", "nombre")
        return Response(TableroSerializer(qs, many=True).data)


class TableroAutocompleteView(APIView):
    """
    Autocomplete liviano.
    GET /api/tableros/autocomplete/?q=TI%201400&limit=20
    """

    permission_classes = [AllowAny]

    def get(self, request):
        q = (request.query_params.get("q") or "").strip()
        limit = int(request.query_params.get("limit") or 20)
        limit = max(5, min(limit, 30))

        qs = Tablero.objects.all()

        if q:
            q = " ".join(q.split())
            qs = qs.filter(nombre__icontains=q)

        data = list(qs.order_by("nombre").values("nombre", "zona")[:limit])
        return Response(data)


def _parse_date(s: str | None) -> date | None:
    if not s:
        return None
    try:
        # espera YYYY-MM-DD
        y, m, d = s.split("-")
        return date(int(y), int(m), int(d))
    except Exception:
        return None


class HistorialView(APIView):
    """
    Historial paginado + filtros, con tablero opcional.
    GET /api/historial/?tablero=TI%201400&page=1&page_size=20&desde=2025-01-01&hasta=2025-01-31&circuito=fd1&q=texto
    Si NO mandás tablero -> devuelve historial global (más pesado, se recomienda usar filtros).
    """

    permission_classes = [AllowAny]

    def get(self, request):
        tablero = (request.query_params.get("tablero") or "").strip()
        circuito = (request.query_params.get("circuito") or "").strip()
        qtext = (request.query_params.get("q") or "").strip()

        desde = _parse_date((request.query_params.get("desde") or "").strip())
        hasta = _parse_date((request.query_params.get("hasta") or "").strip())

        page = int(request.query_params.get("page") or 1)
        page_size = int(request.query_params.get("page_size") or 20)
        page = max(1, page)
        page_size = max(5, min(page_size, 50))

        qs = HistorialTarea.objects.select_related("tablero").all()

        # tablero: exacto o parcial
        if tablero:
            tnorm = " ".join(tablero.split())
            # si existe exacto, priorizamos exacto
            exact = Tablero.objects.filter(nombre__iexact=tnorm).first()
            if exact:
                qs = qs.filter(tablero=exact)
            else:
                qs = qs.filter(tablero__nombre__icontains=tnorm)

        if circuito:
            qs = qs.filter(circuito__icontains=circuito)

        if desde:
            qs = qs.filter(fecha__gte=desde)
        if hasta:
            qs = qs.filter(fecha__lte=hasta)

        if qtext:
            # busca en campos analíticos + legado
            qs = qs.filter(
                Q(tarea_realizada__icontains=qtext)
                | Q(tarea_pedida__icontains=qtext)
                | Q(tarea_pendiente__icontains=qtext)
                | Q(descripcion__icontains=qtext)
            )

        qs = qs.order_by("-fecha", "-creado")

        total = qs.count()

        start = (page - 1) * page_size
        end = start + page_size
        rows = qs[start:end]

        # header informativo
        header_tablero = ""
        header_zona = ""

        if tablero:
            # si filtró por exacto lo reflejamos mejor
            exact = Tablero.objects.filter(
                nombre__iexact=" ".join(tablero.split())
            ).first()
            if exact:
                header_tablero = exact.nombre
                header_zona = exact.zona
            else:
                header_tablero = tablero  # texto ingresado (parcial)

        results = []
        for h in rows:
            results.append(
                {
                    "id": h.id,
                    "fecha": h.fecha.isoformat(),
                    "creado": h.creado.isoformat() if h.creado else None,
                    "tablero": h.tablero.nombre if h.tablero_id else "",
                    "zona": h.zona or (h.tablero.zona if h.tablero_id else ""),
                    "circuito": h.circuito or "",
                    "tarea_realizada": h.tarea_realizada or "",
                    "tarea_pedida": h.tarea_pedida or "",
                    "tarea_pendiente": h.tarea_pendiente or "",
                    "descripcion": h.descripcion or "",
                }
            )

        return Response(
            {
                "tablero": header_tablero,
                "zona": header_zona,
                "count": total,
                "page": page,
                "page_size": page_size,
                "results": results,
            }
        )


class CircuitosFrecuentesView(APIView):
    """
    Circuitos más frecuentes de un tablero (para chips).
    GET /api/tableros/circuitos/?tablero=TI%201400&limit=8
    """

    permission_classes = [AllowAny]

    def get(self, request):
        tablero = (request.query_params.get("tablero") or "").strip()
        limit = int(request.query_params.get("limit") or 8)
        limit = max(3, min(limit, 15))

        if not tablero:
            return Response({"items": []})

        tnorm = " ".join(tablero.split())
        exact = Tablero.objects.filter(nombre__iexact=tnorm).first()

        if not exact:
            # sin tablero exacto no devolvemos sugerencias (evita ruido)
            return Response({"items": []})

        qs = (
            HistorialTarea.objects.filter(tablero=exact)
            .exclude(circuito__isnull=True)
            .exclude(circuito__exact="")
            .values("circuito")
            .annotate(n=Count("id"))
            .order_by("-n", "circuito")[:limit]
        )

        return Response({"tablero": exact.nombre, "items": list(qs)})


#


class TableroExistsView(APIView):
    """
    GET /api/tableros/exists/?nombre=TI%201400
    Respuesta:
      { "exists": true, "nombre": "TI 1400", "zona": "..." }
      { "exists": false, "nombre": "TI 1400" }
    """

    def get(self, request):
        raw = (request.query_params.get("nombre") or "").strip()
        if not raw:
            return Response(
                {"detail": "Falta parámetro 'nombre'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        t = Tablero.objects.filter(nombre__iexact=raw).only("nombre", "zona").first()
        if t:
            return Response(
                {"exists": True, "nombre": t.nombre, "zona": t.zona},
                status=status.HTTP_200_OK,
            )

        return Response(
            {"exists": False, "nombre": raw},
            status=status.HTTP_200_OK,
        )
