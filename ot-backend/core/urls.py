from django.contrib import admin
from django.urls import path
from orders.views import OrdenListCreateView, OrdenPDFView
from django.conf import settings
from django.conf.urls.static import static
from django.urls import path, include

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/ordenes/", OrdenListCreateView.as_view()),
    path("api/ordenes/pdf/", OrdenPDFView.as_view()),
    path("api/", include("historial.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
