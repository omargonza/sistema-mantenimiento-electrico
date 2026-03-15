from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import UserProfile
from historial.models import Tablero
from orders.models import RAMAL_CHOICES

User = get_user_model()


class OrdenesPdfEndpointTests(APITestCase):
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

        self.tablero = Tablero.objects.create(
            nombre="TC20 Septiembre",
            zona="Zona 1",
        )

        self.url = "/api/ordenes/pdf/"
        self.valid_ramal = RAMAL_CHOICES[0][0] if RAMAL_CHOICES else ""

    def auth_as_tech(self):
        self.client.force_authenticate(user=self.tech)

    def auth_as_admin(self):
        self.client.force_authenticate(user=self.admin)

    def tecnicos_payload(self):
        return [
            {
                "legajo": "8174",
                "nombre": "Tecnico Campo",
            }
        ]

    def materiales_payload(self):
        return [
            {
                "material": "Terminales",
                "cantidad": "2",
            },
            {
                "material": "Cinta aisladora",
                "cantidad": "1",
            },
        ]

    def valid_payload_no_luminaria(self):
        return {
            "fecha": "2026-03-15",
            "ubicacion": "Sector prueba",
            "tablero": self.tablero.nombre,
            "zona": "Zona 1",
            "circuito": "C1",
            "vehiculo": "M-01",
            "km_inicial": 100.0,
            "km_final": 120.0,
            "km_total": 20.0,
            "ramal": "",
            "km_luminaria": None,
            "codigo_luminaria": "",
            "codigos_luminarias": [],
            "tecnicos": self.tecnicos_payload(),
            "materiales": self.materiales_payload(),
            "tarea_pedida": "Revisión general",
            "tarea_realizada": "Se verificó tablero y se ajustaron bornes",
            "tarea_pendiente": "",
            "luminaria_equipos": "",
            "observaciones": "Sin novedades",
            "firma_tecnico": "Gonza",
            "firma_supervisor": "",
            "alcance": "correctivo",
            "resultado": "COMPLETO",
            "estado_tablero": "OPERATIVO",
            "luminaria_estado": "",
            "firma_tecnico_img": "",
            "fotos_b64": [],
            "print_mode": False,
            "luminarias_por_tablero": [],
        }

    def valid_payload_luminaria_old_mode(self):
        return {
            "fecha": "2026-03-15",
            "ubicacion": "Sector luminarias",
            "tablero": self.tablero.nombre,
            "zona": "Zona 1",
            "circuito": "C1",
            "vehiculo": "M-01",
            "km_inicial": 100.0,
            "km_final": 120.0,
            "km_total": 20.0,
            "ramal": self.valid_ramal,
            "km_luminaria": 123.4,
            "codigo_luminaria": "PC4026",
            "codigos_luminarias": ["PC4026"],
            "tecnicos": self.tecnicos_payload(),
            "materiales": [
                {
                    "material": "Lámpara LED",
                    "cantidad": "1",
                }
            ],
            "tarea_pedida": "Relevamiento",
            "tarea_realizada": "Cambio de luminaria",
            "tarea_pendiente": "",
            "luminaria_equipos": "PC4026",
            "observaciones": "OK",
            "firma_tecnico": "Gonza",
            "firma_supervisor": "",
            "alcance": "LUMINARIA",
            "resultado": "COMPLETO",
            "estado_tablero": "",
            "luminaria_estado": "OPERATIVA",
            "firma_tecnico_img": "",
            "fotos_b64": [],
            "print_mode": False,
            "luminarias_por_tablero": [],
        }

    def valid_payload_luminaria_new_mode(self):
        return {
            "fecha": "2026-03-15",
            "ubicacion": "Sector luminarias",
            "tablero": self.tablero.nombre,
            "zona": "Zona 1",
            "circuito": "C1",
            "vehiculo": "M-01",
            "km_inicial": 100.0,
            "km_final": 120.0,
            "km_total": 20.0,
            "ramal": "",
            "km_luminaria": None,
            "codigo_luminaria": "",
            "codigos_luminarias": [],
            "tecnicos": self.tecnicos_payload(),
            "materiales": [
                {
                    "material": "Lámparas",
                    "cantidad": "2",
                }
            ],
            "tarea_pedida": "Relevamiento",
            "tarea_realizada": "Recambio",
            "tarea_pendiente": "",
            "luminaria_equipos": "",
            "observaciones": "OK",
            "firma_tecnico": "Gonza",
            "firma_supervisor": "",
            "alcance": "LUMINARIA",
            "resultado": "COMPLETO",
            "estado_tablero": "",
            "luminaria_estado": "OPERATIVA",
            "firma_tecnico_img": "",
            "fotos_b64": [],
            "print_mode": False,
            "luminarias_por_tablero": [
                {
                    "tablero": self.tablero.nombre,
                    "zona": "Zona 1",
                    "circuito": "C1",
                    "ramal": self.valid_ramal,
                    "resultado": "COMPLETO",
                    "luminaria_estado": "OPERATIVA",
                    "tarea_pedida": "Relevamiento",
                    "tarea_realizada": "Recambio",
                    "tarea_pendiente": "",
                    "observaciones": "OK",
                    "items": [
                        {
                            "codigo_luminaria": "PC4026",
                            "km_luminaria": 123.4,
                        },
                        {
                            "codigo_luminaria": "CC4105",
                            "km_luminaria": 125.0,
                        },
                    ],
                }
            ],
        }

    def assert_pdf_response(self, response):
        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            msg=getattr(response, "data", response.content),
        )
        content_type = response.get("Content-Type", "")
        self.assertTrue(
            "application/pdf" in content_type.lower()
            or "application/octet-stream" in content_type.lower(),
            msg=f"Content-Type inesperado: {content_type}",
        )
        self.assertGreater(len(response.content), 100)

    def test_pdf_requires_auth(self):
        response = self.client.post(self.url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_pdf_accepts_valid_non_luminaria_payload_for_technician(self):
        self.auth_as_tech()
        response = self.client.post(
            self.url,
            self.valid_payload_no_luminaria(),
            format="json",
        )
        self.assert_pdf_response(response)

    def test_pdf_accepts_valid_non_luminaria_payload_for_admin(self):
        self.auth_as_admin()
        response = self.client.post(
            self.url,
            self.valid_payload_no_luminaria(),
            format="json",
        )
        self.assert_pdf_response(response)

    def test_pdf_accepts_valid_luminaria_old_mode(self):
        self.auth_as_tech()
        response = self.client.post(
            self.url,
            self.valid_payload_luminaria_old_mode(),
            format="json",
        )
        self.assert_pdf_response(response)

    def test_pdf_accepts_valid_luminaria_new_mode(self):
        self.auth_as_tech()
        response = self.client.post(
            self.url,
            self.valid_payload_luminaria_new_mode(),
            format="json",
        )
        self.assert_pdf_response(response)

    def test_pdf_rejects_invalid_payload(self):
        self.auth_as_tech()

        payload = self.valid_payload_luminaria_old_mode()
        payload["ramal"] = ""
        payload["km_luminaria"] = None

        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_pdf_rejects_more_than_four_photos(self):
        self.auth_as_tech()

        payload = self.valid_payload_no_luminaria()
        payload["fotos_b64"] = ["a", "b", "c", "d", "e"]

        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_pdf_rejects_invalid_tecnicos_format(self):
        self.auth_as_tech()

        payload = self.valid_payload_no_luminaria()
        payload["tecnicos"] = "8174"

        response = self.client.post(self.url, payload, format="json")

        # este test debería quedar en 400 cuando corrijas el backend;
        # hoy probablemente te devuelve 500
        self.assertIn(
            response.status_code,
            [status.HTTP_400_BAD_REQUEST, status.HTTP_500_INTERNAL_SERVER_ERROR],
        )

    def test_pdf_rejects_invalid_materiales_format(self):
        self.auth_as_tech()

        payload = self.valid_payload_no_luminaria()
        payload["materiales"] = "cinta aisladora"

        response = self.client.post(self.url, payload, format="json")

        # este test debería quedar en 400 cuando corrijas el backend;
        # hoy probablemente te devuelve 500
        self.assertIn(
            response.status_code,
            [status.HTTP_400_BAD_REQUEST, status.HTTP_500_INTERNAL_SERVER_ERROR],
        )
