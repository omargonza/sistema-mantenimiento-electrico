from rest_framework.permissions import BasePermission


class IsAdminRole(BasePermission):
    message = "No autorizado. Solo administradores."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and hasattr(user, "profile")
            and user.profile.role == "admin"
        )


class IsAdminOrTechnicianRole(BasePermission):
    message = "No autorizado."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and hasattr(user, "profile")
            and user.profile.role in {"admin", "technician"}
        )
