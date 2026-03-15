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
        return Response(MeSerializer(request.user), status=status.HTTP_200_OK)


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

        if hasattr(instance, "profile"):
            instance.profile.is_soft_deleted = True
            instance.profile.save(update_fields=["is_soft_deleted", "updated_at"])

        return Response(
            {"detail": "Usuario desactivado correctamente."},
            status=status.HTTP_200_OK,
        )
