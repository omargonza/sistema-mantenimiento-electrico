from django.urls import path
from .views import (
    TablerosListView,
    TableroAutocompleteView,
    HistorialView,
    CircuitosFrecuentesView,
    TableroExistsView,
)

urlpatterns = [
    # catálogo completo (si lo necesitás)
    path("tableros/", TablerosListView.as_view(), name="tableros_list"),
    # autocomplete liviano
    path(
        "tableros/autocomplete/",
        TableroAutocompleteView.as_view(),
        name="tableros_autocomplete",
    ),
    # historial (por tablero opcional) + filtros + paginado
    path("historial/", HistorialView.as_view(), name="historial"),
    # circuitos frecuentes por tablero (para chips)
    path(
        "tableros/circuitos/",
        CircuitosFrecuentesView.as_view(),
        name="tableros_circuitos",
    ),
    path("tableros/exists/", TableroExistsView.as_view(), name="tablero_exists"),
]
