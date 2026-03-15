from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework import status

from accounts.models import UserProfile

User = get_user_model()


class AuthFlowTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="8174",
            email="test@test.com",
            password="electricos2514@",
            is_active=True,
        )
        UserProfile.objects.get_or_create(
            user=self.user,
            defaults={
                "nombre_completo": "Gonza",
                "role": UserProfile.Role.ADMIN,
            },
        )

    def test_login_ok(self):
        response = self.client.post(
            "/api/auth/login/",
            {"username": "8174", "password": "electricos2514@"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertIn("user", response.data)

    def test_login_bad_password(self):
        response = self.client.post(
            "/api/auth/login/",
            {"username": "8174", "password": "incorrecta"},
            format="json",
        )
        self.assertIn(
            response.status_code,
            [status.HTTP_400_BAD_REQUEST, status.HTTP_401_UNAUTHORIZED],
        )

    def test_historial_requires_auth(self):
        response = self.client.get("/api/historial/?page=1&page_size=3&tablero=TC20")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_with_auth(self):
        login = self.client.post(
            "/api/auth/login/",
            {"username": "8174", "password": "electricos2514@"},
            format="json",
        )
        token = login.data["access"]

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["legajo"], "8174")
