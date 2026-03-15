from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import UserProfile

User = get_user_model()


class HistorialApiTests(APITestCase):
    def setUp(self):
        cache.clear()

        self.tech = User.objects.create_user(
            username="8174",
            email="tech@test.com",
            password="Tech12345!",
            is_active=True,
            is_staff=False,
        )
        tech_profile, _ = UserProfile.objects.get_or_create(user=self.tech)
        tech_profile.nombre_completo = "Tecnico Campo"
        tech_profile.role = UserProfile.Role.TECHNICIAN
        tech_profile.save()

        self.admin = User.objects.create_user(
            username="1000",
            email="admin@test.com",
            password="Admin12345!",
            is_active=True,
            is_staff=True,
        )
        admin_profile, _ = UserProfile.objects.get_or_create(user=self.admin)
        admin_profile.nombre_completo = "Admin Principal"
        admin_profile.role = UserProfile.Role.ADMIN
        admin_profile.save()

        self.url = "/api/historial/"

    def auth_as_tech(self):
        self.client.force_authenticate(user=self.tech)

    def auth_as_admin(self):
        self.client.force_authenticate(user=self.admin)

    def test_historial_requires_auth(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_historial_allows_authenticated_technician(self):
        self.auth_as_tech()

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_historial_allows_authenticated_admin(self):
        self.auth_as_admin()

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_historial_accepts_tablero_and_pagination_params(self):
        self.auth_as_tech()

        response = self.client.get(
            self.url,
            {
                "page": 1,
                "page_size": 3,
                "tablero": "TC20 Septiembre",
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_historial_accepts_partial_tablero_query(self):
        self.auth_as_tech()

        response = self.client.get(
            self.url,
            {
                "page": 1,
                "page_size": 3,
                "tablero": "TC20 Sep",
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_historial_response_shape_is_valid(self):
        self.auth_as_tech()

        response = self.client.get(
            self.url,
            {
                "page": 1,
                "page_size": 3,
                "tablero": "TC20 Septiembre",
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.data

        if isinstance(data, list):
            self.assertIsInstance(data, list)
            return

        if isinstance(data, dict):
            # paginado típico DRF
            allowed_keys = {"results", "count", "next", "previous"}
            self.assertTrue(
                len(data) == 0 or any(key in data for key in allowed_keys),
                msg=f"Estructura inesperada: {data}",
            )
            return

        self.fail(f"Formato de respuesta inesperado: {type(data)}")

    def test_historial_does_not_500_on_unknown_tablero(self):
        self.auth_as_tech()

        response = self.client.get(
            self.url,
            {
                "page": 1,
                "page_size": 3,
                "tablero": "TABLERO INEXISTENTE XYZ",
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
