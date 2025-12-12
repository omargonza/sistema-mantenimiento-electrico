from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.http import HttpResponse

from .models import OrdenTrabajo
from .serializers import OrdenTrabajoSerializer
from .pdf import generar_pdf


class OrdenListCreateView(APIView):
    def get(self, request):
        ordenes = OrdenTrabajo.objects.all().order_by("-id")
        serializer = OrdenTrabajoSerializer(ordenes, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = OrdenTrabajoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    
import os
from django.conf import settings
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from django.http import HttpResponse
from .serializers import OrdenTrabajoSerializer
from .pdf import generar_pdf

from rest_framework.response import Response
from rest_framework import status

class OrdenPDFView(APIView):
    def post(self, request):
        serializer = OrdenTrabajoSerializer(data=request.data)

        # NO usar raise_exception por ahora
        if not serializer.is_valid():
            print("ERRORES SERIALIZER OT:", serializer.errors)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data

        pdf_bytes = generar_pdf(data)

        ahora = timezone.now()
        year = ahora.strftime("%Y")
        month = ahora.strftime("%m")

        folder = os.path.join(settings.MEDIA_ROOT, "ordenes", year, month)
        os.makedirs(folder, exist_ok=True)

        fecha = data.get("fecha", "")
        tablero = data.get("tablero", "OT")
        filename = f"OT_{fecha}_{tablero}_{int(ahora.timestamp())}.pdf"
        filepath = os.path.join(folder, filename)

        with open(filepath, "wb") as f:
            f.write(pdf_bytes)

        resp = HttpResponse(pdf_bytes, content_type="application/pdf")
        resp["Content-Disposition"] = f'attachment; filename="{filename}"'
        return resp
