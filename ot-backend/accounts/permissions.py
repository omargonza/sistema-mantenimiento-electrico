from rest_framework.permissions import BasePermission

from .models import UserProfile


class IsAdminRole(BasePermission):
    message = "No autorizado. Solo administradores."

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        return UserProfile.objects.filter(
            user=user,
            role=UserProfile.Role.ADMIN,
        ).exists()


class IsAdminOrTechnicianRole(BasePermission):
    message = "No autorizado."

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        return UserProfile.objects.filter(
            user=user,
            role__in=[
                UserProfile.Role.ADMIN,
                UserProfile.Role.TECHNICIAN,
            ],
        ).exists()
