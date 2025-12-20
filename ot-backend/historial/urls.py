from django.urls import path
from .views import TablerosListView, HistorialPorTablero

urlpatterns = [
    path("tableros/", TablerosListView.as_view(), name="tableros_list"),
    path("historial/", HistorialPorTablero.as_view(), name="historial_por_tablero"),
]
