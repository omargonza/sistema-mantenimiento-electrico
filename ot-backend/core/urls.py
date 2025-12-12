
from django.contrib import admin
from django.urls import path
from orders.views import OrdenListCreateView, OrdenPDFView
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("admin/", admin.site.urls),

    # API principal
    path("api/ordenes/", OrdenListCreateView.as_view()),
    path("api/ordenes/pdf/", OrdenPDFView.as_view()),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
