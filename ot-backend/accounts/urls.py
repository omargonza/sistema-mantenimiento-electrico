# accounts/urls.py
from django.urls import path

from .views import (
    LoginView,
    RefreshView,
    VerifyView,
    LogoutView,
    MeView,
    UserAdminListCreateView,
    UserAdminDetailView,
)

urlpatterns = [
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/refresh/", RefreshView.as_view(), name="auth-refresh"),
    path("auth/verify/", VerifyView.as_view(), name="auth-verify"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path("auth/me/", MeView.as_view(), name="auth-me"),
    # === USUARIOS ADMIN ===
    path(
        "auth/users/", UserAdminListCreateView.as_view(), name="users-admin-list-create"
    ),
    path(
        "auth/users/<int:pk>/", UserAdminDetailView.as_view(), name="users-admin-detail"
    ),
]
