from rest_framework.views import APIView
from rest_framework.response import Response

from .models import Tablero
from .serializers import TableroSerializer


class TablerosListView(APIView):
    """
    Catálogo de tableros (para dropdown/autocomplete).
    GET /api/tableros/
    """
    def get(self, request):
        qs = Tablero.objects.all().order_by("zona", "nombre")
        return Response(TableroSerializer(qs, many=True).data)


class HistorialPorTablero(APIView):
    """
    Historial por tablero (para la pantalla de historial).
    GET /api/historial/?tablero=TI%201400
    """
    def get(self, request):
        nombre = (request.query_params.get("tablero") or "").strip()

        if not nombre:
            return Response({"error": "Falta parámetro 'tablero'."}, status=400)

        try:
            tablero = Tablero.objects.get(nombre=nombre)
        except Tablero.DoesNotExist:
            return Response({"error": "Tablero no encontrado."}, status=404)

        historial = tablero.historial.all().order_by("-fecha")[:300]  # tope liviano

        return Response({
            "tablero": tablero.nombre,
            "zona": tablero.zona,
            "historial": [
                {
                    "fecha": h.fecha.isoformat(),
                    "circuito": h.circuito,
                    "descripcion": h.descripcion,
                }
                for h in historial
            ]
        })
