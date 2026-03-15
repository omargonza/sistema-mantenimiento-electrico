from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import UserProfile

User = get_user_model()


class LoginThrottlingTests(APITestCase):
    def setUp(self):
        cache.clear()

        self.user = User.objects.create_user(
            username="8174",
            email="tech@test.com",
            password="Tech12345!",
            is_active=True,
            is_staff=False,
        )
        profile, _ = UserProfile.objects.get_or_create(user=self.user)
        profile.nombre_completo = "Tecnico Campo"
        profile.role = UserProfile.Role.TECHNICIAN
        profile.save()

        self.url = "/api/auth/login/"

    def login(self, username="8174", password="Tech12345!"):
        return self.client.post(
            self.url,
            {
                "username": username,
                "password": password,
            },
            format="json",
        )

    def test_login_allows_valid_credentials_before_limit(self):
        # Con tu config actual: "login": "5/min"
        # Hacemos 5 intentos válidos y deberían pasar.
        responses = [self.login() for _ in range(5)]

        for response in responses:
            self.assertEqual(
                response.status_code,
                status.HTTP_200_OK,
                msg=getattr(response, "data", response.content),
            )

    def test_login_throttles_on_sixth_attempt(self):
        for _ in range(5):
            response = self.login()
            self.assertEqual(
                response.status_code,
                status.HTTP_200_OK,
                msg=getattr(response, "data", response.content),
            )

        sixth = self.login()

        self.assertEqual(sixth.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_login_invalid_credentials_also_count_toward_throttle(self):
        # DRF throttle suele contar requests, no solo logins exitosos.
        for _ in range(5):
            response = self.login(password="incorrecta")
            self.assertIn(
                response.status_code,
                [status.HTTP_400_BAD_REQUEST, status.HTTP_401_UNAUTHORIZED],
                msg=getattr(response, "data", response.content),
            )

        sixth = self.login(password="incorrecta")
        self.assertEqual(sixth.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_login_throttle_is_endpoint_specific_not_global_auth(self):
        # Consumimos el cupo del login
        for _ in range(5):
            response = self.login()
            self.assertEqual(response.status_code, status.HTTP_200_OK)

        throttled = self.login()
        self.assertEqual(throttled.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

        # Otro endpoint debería seguir respondiendo normalmente
        me_response = self.client.get("/api/auth/me/")
        self.assertEqual(me_response.status_code, status.HTTP_401_UNAUTHORIZED)

    def tearDown(self):
        cache.clear()
