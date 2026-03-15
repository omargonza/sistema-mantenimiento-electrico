from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import UserProfile

User = get_user_model()


class UserAdminPermissionsTests(APITestCase):
    def setUp(self):
        cache.clear()

        # Admin
        self.admin = User.objects.create_user(
            username="1000",
            email="admin@test.com",
            password="Admin12345!",
            is_active=True,
            is_staff=True,
        )
        self.admin_profile, _ = UserProfile.objects.get_or_create(user=self.admin)
        self.admin_profile.nombre_completo = "Admin Principal"
        self.admin_profile.role = UserProfile.Role.ADMIN
        self.admin_profile.save()

        # Técnico
        self.tech = User.objects.create_user(
            username="2000",
            email="tech@test.com",
            password="Tech12345!",
            is_active=True,
            is_staff=False,
        )
        self.tech_profile, _ = UserProfile.objects.get_or_create(user=self.tech)
        self.tech_profile.nombre_completo = "Tecnico Uno"
        self.tech_profile.role = UserProfile.Role.TECHNICIAN
        self.tech_profile.save()

        # Otro usuario
        self.other_user = User.objects.create_user(
            username="3000",
            email="otro@test.com",
            password="Otro12345!",
            is_active=True,
            is_staff=False,
        )
        self.other_profile, _ = UserProfile.objects.get_or_create(user=self.other_user)
        self.other_profile.nombre_completo = "Otro Usuario"
        self.other_profile.role = UserProfile.Role.TECHNICIAN
        self.other_profile.save()

        self.users_url = "/api/users/"

    def auth_as_admin(self):
        self.client.force_authenticate(user=self.admin)

    def auth_as_tech(self):
        self.client.force_authenticate(user=self.tech)

    def test_admin_shape(self):
        self.admin.refresh_from_db()
        self.admin.profile.refresh_from_db()

        self.assertTrue(self.admin.is_staff)
        self.assertEqual(self.admin.profile.role, UserProfile.Role.ADMIN)

    def test_admin_login_returns_admin_role(self):
        response = self.client.post(
            "/api/auth/login/",
            {"username": "1000", "password": "Admin12345!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["user"]["profile"]["role"], "admin")

    def test_admin_can_list_users(self):
        self.auth_as_admin()

        response = self.client.get(self.users_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_technician_cannot_list_users(self):
        self.auth_as_tech()

        response = self.client.get(self.users_url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_unauthenticated_cannot_list_users(self):
        response = self.client.get(self.users_url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_admin_can_create_user(self):
        self.auth_as_admin()

        payload = {
            "legajo": "4000",
            "email": "nuevo@test.com",
            "password": "Nuevo12345!",
            "nombre_completo": "Nuevo Usuario",
            "role": UserProfile.Role.TECHNICIAN,
            "is_active": True,
            "is_staff": False,
        }

        response = self.client.post(self.users_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        created = User.objects.get(username="4000")
        self.assertEqual(created.email, "nuevo@test.com")
        self.assertTrue(hasattr(created, "profile"))
        self.assertEqual(created.profile.nombre_completo, "Nuevo Usuario")
        self.assertEqual(created.profile.role, UserProfile.Role.TECHNICIAN)

    def test_technician_cannot_create_user(self):
        self.auth_as_tech()

        payload = {
            "legajo": "4001",
            "email": "blocked@test.com",
            "password": "Blocked12345!",
            "nombre_completo": "No Permitido",
            "role": UserProfile.Role.TECHNICIAN,
        }

        response = self.client.post(self.users_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(User.objects.filter(username="4001").exists())

    def test_admin_can_update_user_role_to_admin(self):
        self.auth_as_admin()

        response = self.client.patch(
            f"{self.users_url}{self.other_user.pk}/",
            {
                "role": UserProfile.Role.ADMIN,
                "nombre_completo": "Otro Usuario Admin",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.other_user.refresh_from_db()
        self.other_user.profile.refresh_from_db()

        self.assertTrue(self.other_user.is_staff)
        self.assertEqual(self.other_user.profile.role, UserProfile.Role.ADMIN)
        self.assertEqual(
            self.other_user.profile.nombre_completo,
            "Otro Usuario Admin",
        )

    def test_admin_can_update_user_to_technician_and_remove_staff(self):
        self.other_user.is_staff = True
        self.other_user.save(update_fields=["is_staff"])
        self.other_user.profile.role = UserProfile.Role.ADMIN
        self.other_user.profile.save(update_fields=["role", "updated_at"])

        self.auth_as_admin()

        response = self.client.patch(
            f"{self.users_url}{self.other_user.pk}/",
            {
                "role": UserProfile.Role.TECHNICIAN,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.other_user.refresh_from_db()
        self.other_user.profile.refresh_from_db()

        self.assertFalse(self.other_user.is_staff)
        self.assertEqual(self.other_user.profile.role, UserProfile.Role.TECHNICIAN)

    def test_technician_cannot_update_users(self):
        self.auth_as_tech()

        response = self.client.patch(
            f"{self.users_url}{self.other_user.pk}/",
            {
                "nombre_completo": "Intento Tecnico",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_soft_delete_user(self):
        self.auth_as_admin()

        response = self.client.delete(f"{self.users_url}{self.other_user.pk}/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.other_user.refresh_from_db()
        self.other_user.profile.refresh_from_db()

        self.assertFalse(self.other_user.is_active)
        self.assertTrue(self.other_user.profile.is_soft_deleted)

    def test_admin_cannot_disable_himself(self):
        self.auth_as_admin()

        response = self.client.delete(f"{self.users_url}{self.admin.pk}/")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        self.admin.refresh_from_db()
        self.assertTrue(self.admin.is_active)

    def test_create_user_requires_strong_password(self):
        self.auth_as_admin()

        payload = {
            "legajo": "5000",
            "email": "weak@test.com",
            "password": "123",
            "nombre_completo": "Password Debil",
            "role": UserProfile.Role.TECHNICIAN,
        }

        response = self.client.post(self.users_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(username="5000").exists())
