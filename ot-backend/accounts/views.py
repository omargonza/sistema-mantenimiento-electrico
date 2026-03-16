from django.contrib.auth import get_user_model
from rest_framework import status, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
    TokenBlacklistView,
)

from .permissions import IsAdminRole
from .serializers import (
    UsernameTokenObtainPairSerializer,
    MeSerializer,
    UserCreateSerializer,
    UserListSerializer,
    UserUpdateSerializer,
)

User = get_user_model()


class LoginView(TokenObtainPairView):
    permission_classes = [AllowAny]
    serializer_class = UsernameTokenObtainPairSerializer
    throttle_scope = "login"


class RefreshView(TokenRefreshView):
    permission_classes = [AllowAny]


class VerifyView(TokenVerifyView):
    permission_classes = [AllowAny]


class LogoutView(TokenBlacklistView):
    permission_classes = [IsAuthenticated]


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(MeSerializer(request.user).data, status=status.HTTP_200_OK)


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.select_related("profile").all().order_by("-date_joined")
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        if self.action in ("update", "partial_update"):
            return UserUpdateSerializer
        return UserListSerializer

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()

        if instance.pk == request.user.pk:
            return Response(
                {"detail": "No podés desactivarte a vos mismo."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        instance.is_active = False
        instance.save(update_fields=["is_active"])

        profile = getattr(instance, "profile", None)
        if profile:
            profile.is_soft_deleted = True
            profile.save(update_fields=["is_soft_deleted", "updated_at"])

        return Response(
            {"detail": "Usuario desactivado correctamente."},
            status=status.HTTP_200_OK,
        )

    # accounts/views.py


from django.contrib.auth import get_user_model
from rest_framework import filters, generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import UserProfile
from .permissions import IsStaffUser
from .serializers import (
    UserCreateSerializer,
    UserListSerializer,
    UserUpdateSerializer,
)

User = get_user_model()


class UserAdminListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated, IsStaffUser]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["username", "email", "profile__nombre_completo"]
    ordering_fields = ["username", "email", "date_joined", "last_login"]
    ordering = ["username"]

    def get_queryset(self):
        qs = User.objects.select_related("profile").all()

        include_deleted = self.request.query_params.get("include_deleted") == "1"
        role = self.request.query_params.get("role", "").strip()

        if not include_deleted:
            qs = qs.filter(profile__is_soft_deleted=False)

        if role in {UserProfile.Role.ADMIN, UserProfile.Role.TECHNICIAN}:
            qs = qs.filter(profile__role=role)

        return qs

    def get_serializer_class(self):
        if self.request.method == "POST":
            return UserCreateSerializer
        return UserListSerializer


class UserAdminDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated, IsStaffUser]
    queryset = User.objects.select_related("profile").all()

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return UserUpdateSerializer
        return UserListSerializer

    def delete(self, request, *args, **kwargs):
        instance = self.get_object()

        if instance.pk == request.user.pk:
            raise ValidationError({"detail": "No podés eliminar tu propio usuario."})

        if instance.is_staff:
            admins_restantes = (
                User.objects.filter(is_staff=True, is_active=True)
                .exclude(pk=instance.pk)
                .count()
            )
            if admins_restantes == 0:
                raise ValidationError(
                    {"detail": "No podés eliminar el último admin activo."}
                )

        profile, _ = UserProfile.objects.get_or_create(user=instance)

        instance.is_active = False
        instance.save(update_fields=["is_active"])

        profile.is_soft_deleted = True
        profile.save(update_fields=["is_soft_deleted", "updated_at"])

        return Response(
            {"detail": "Usuario desactivado correctamente."},
            status=status.HTTP_200_OK,
        )
