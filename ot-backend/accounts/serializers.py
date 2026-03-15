from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import UserProfile

User = get_user_model()


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ("nombre_completo", "role", "is_soft_deleted")


class MeSerializer(serializers.ModelSerializer):
    legajo = serializers.CharField(source="username", read_only=True)
    profile = UserProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "legajo",
            "email",
            "is_active",
            "is_staff",
            "profile",
        )


class UsernameTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Login real con username + password.
    En tu negocio, username = legajo.
    """

    default_error_messages = {"no_active_account": "Credenciales inválidas"}

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        profile = getattr(user, "profile", None)
        if profile is None:
            profile, _ = UserProfile.objects.get_or_create(user=user)

        token["legajo"] = user.username
        token["role"] = profile.role
        token["nombre_completo"] = profile.nombre_completo or user.username

        return token

    def validate(self, attrs):
        username = str(attrs.get("username", "")).strip()
        password = attrs.get("password", "")

        if not username or not password:
            raise serializers.ValidationError(
                {"detail": "Usuario y contraseña son obligatorios"}
            )

        user = authenticate(
            request=self.context.get("request"),
            username=username,
            password=password,
        )

        if not user or not user.is_active:
            raise serializers.ValidationError({"detail": "Credenciales inválidas"})

        refresh = self.get_token(user)

        return {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "user": MeSerializer(user).data,
        }


class UserCreateSerializer(serializers.ModelSerializer):
    legajo = serializers.CharField(write_only=True)
    password = serializers.CharField(write_only=True, min_length=8)
    nombre_completo = serializers.CharField(write_only=True)
    role = serializers.ChoiceField(
        choices=UserProfile.Role.choices,
        write_only=True,
        default=UserProfile.Role.TECHNICIAN,
    )

    profile = UserProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "legajo",
            "email",
            "password",
            "is_active",
            "is_staff",
            "nombre_completo",
            "role",
            "profile",
        )

    def validate_password(self, value):
        validate_password(value)
        return value

    @transaction.atomic
    def create(self, validated_data):
        legajo = validated_data.pop("legajo").strip()
        password = validated_data.pop("password")
        nombre_completo = validated_data.pop("nombre_completo")
        role = validated_data.pop("role")
        email = validated_data.get("email", "").strip()

        user = User(
            username=legajo,
            email=email,
            is_active=validated_data.get("is_active", True),
            is_staff=validated_data.get("is_staff", role == UserProfile.Role.ADMIN),
        )
        user.set_password(password)
        user.save()

        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.nombre_completo = nombre_completo
        profile.role = role
        profile.save(update_fields=["nombre_completo", "role", "updated_at"])

        return user


class UserListSerializer(serializers.ModelSerializer):
    legajo = serializers.CharField(source="username", read_only=True)
    profile = UserProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "legajo",
            "email",
            "is_active",
            "is_staff",
            "date_joined",
            "last_login",
            "profile",
        )


class UserUpdateSerializer(serializers.ModelSerializer):
    legajo = serializers.CharField(write_only=True, required=False)
    password = serializers.CharField(write_only=True, required=False, min_length=8)
    nombre_completo = serializers.CharField(write_only=True, required=False)
    role = serializers.ChoiceField(
        choices=UserProfile.Role.choices,
        write_only=True,
        required=False,
    )

    profile = UserProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = (
            "legajo",
            "email",
            "password",
            "is_active",
            "is_staff",
            "nombre_completo",
            "role",
            "profile",
        )

    def validate_password(self, value):
        validate_password(value)
        return value

    @transaction.atomic
    def update(self, instance, validated_data):
        legajo = validated_data.pop("legajo", None)
        password = validated_data.pop("password", None)
        nombre_completo = validated_data.pop("nombre_completo", None)
        role = validated_data.pop("role", None)

        if legajo is not None:
            instance.username = legajo.strip()

        if "email" in validated_data and validated_data["email"] is not None:
            instance.email = validated_data["email"].strip()

        for attr, value in validated_data.items():
            if attr != "email":
                setattr(instance, attr, value)

        if password:
            instance.set_password(password)

        if role is not None:
            instance.is_staff = role == UserProfile.Role.ADMIN

        instance.save()

        profile, _ = UserProfile.objects.get_or_create(user=instance)

        if nombre_completo is not None:
            profile.nombre_completo = nombre_completo

        if role is not None:
            profile.role = role

        profile.save()

        return instance
