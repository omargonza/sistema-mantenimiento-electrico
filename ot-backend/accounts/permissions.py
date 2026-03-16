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

        # accounts/permissions.py


from rest_framework.permissions import BasePermission


class IsStaffUser(BasePermission):
    message = "No tenés permisos para acceder a esta acción."

    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated and request.user.is_staff
        )
