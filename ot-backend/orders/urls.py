# orders/urls.py
from django.urls import path
from .views import OrdenListCreateView, OrdenPDFView
from .views_luminarias import LuminariasHistorialView

urlpatterns = [
    # Core OT
    path("ordenes/", OrdenListCreateView.as_view(), name="ordenes"),
    path("ordenes/pdf/", OrdenPDFView.as_view(), name="ordenes-pdf"),
    # Luminarias (mapa / historial)
    path(
        "luminarias/historial/",
        LuminariasHistorialView.as_view(),
        name="luminarias-historial",
    ),
]
