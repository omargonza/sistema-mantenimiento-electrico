from django.urls import path
from .views import TablerosListView, HistorialPorTablero

from .views import TableroAutocompleteView

urlpatterns = [
    path("tableros/", TableroAutocompleteView.as_view(), name="tableros_autocomplete"),
]


urlpatterns = [
    path("tableros/", TablerosListView.as_view(), name="tableros_list"),
    path("historial/", HistorialPorTablero.as_view(), name="historial_por_tablero"),
     path("tableros/", TableroAutocompleteView.as_view(), name="tableros_autocomplete"),
]
