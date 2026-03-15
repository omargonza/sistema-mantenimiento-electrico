from typing import Any, cast

from django.test import TestCase
from rest_framework import serializers

from historial.models import Tablero
from orders.serializers import (
    OrdenTrabajoLuminariaGrupoSerializer,
    OrdenTrabajoSerializer,
)


class OrdenTrabajoSerializerRulesTests(TestCase):
    def setUp(self):
        # Ajustá estos campos si tu modelo Tablero requiere otros obligatorios.
        self.tablero = Tablero.objects.create(
            nombre="TC20 Septiembre",
            zona="Zona 1",
        )

    def make_serializer(
        self, initial_data: dict[str, Any] | None = None
    ) -> OrdenTrabajoSerializer:
        serializer = OrdenTrabajoSerializer()
        setattr(serializer, "initial_data", initial_data or {})
        return serializer

    def test_validate_fotos_b64_accepts_empty(self):
        serializer = self.make_serializer()
        self.assertEqual(serializer.validate_fotos_b64([]), [])

    def test_validate_fotos_b64_rejects_more_than_four(self):
        serializer = self.make_serializer()

        with self.assertRaises(serializers.ValidationError) as ctx:
            serializer.validate_fotos_b64(["a", "b", "c", "d", "e"])

        self.assertIn("Máximo 4 fotos", str(ctx.exception))

    def test_validate_fotos_b64_rejects_oversized_item(self):
        serializer = self.make_serializer()
        huge = "x" * 2_000_001

        with self.assertRaises(serializers.ValidationError) as ctx:
            serializer.validate_fotos_b64([huge])

        self.assertIn("demasiado grande", str(ctx.exception))

    def test_validate_luminaria_equipos_normalizes_codes(self):
        serializer = self.make_serializer()

        result = serializer.validate_luminaria_equipos(
            "pc4026, texto libre, cc4105, PC4026"
        )

        self.assertEqual(result, "PC4026, CC4105")

    def test_validate_luminaria_equipos_rejects_invalid_text_without_codes(self):
        serializer = self.make_serializer()

        with self.assertRaises(serializers.ValidationError) as ctx:
            serializer.validate_luminaria_equipos("solo texto sin formato")

        self.assertIn("Formato inválido", str(ctx.exception))

    def test_non_luminaria_cleans_specific_fields(self):
        serializer = self.make_serializer()

        attrs: dict[str, Any] = {
            "alcance": "correctivo",
            "ramal": "A",
            "km_luminaria": 123.4,
            "codigo_luminaria": "pc4026",
            "codigos_luminarias": ["pc4026", "CC4105"],
            "luminaria_estado": "MAL",
            "luminaria_equipos": "PC4026, CC4105",
            "luminarias_por_tablero": [
                {
                    "tablero": self.tablero,
                    "ramal": "A",
                    "items": [{"codigo_luminaria": "PC4026"}],
                }
            ],
        }

        out = cast(dict[str, Any], serializer.validate(attrs))

        self.assertEqual(out["ramal"], "")
        self.assertIsNone(out["km_luminaria"])
        self.assertEqual(out["codigo_luminaria"], "")
        self.assertEqual(out["codigos_luminarias"], [])
        self.assertEqual(out["luminaria_estado"], "")
        self.assertEqual(out["luminaria_equipos"], "")
        self.assertEqual(out["luminarias_por_tablero"], [])

    def test_luminaria_old_mode_requires_ramal(self):
        serializer = self.make_serializer()

        attrs: dict[str, Any] = {
            "alcance": "LUMINARIA",
            "ramal": "",
            "km_luminaria": 100.0,
            "codigos_luminarias": [],
        }

        with self.assertRaises(serializers.ValidationError) as ctx:
            serializer.validate(attrs)

        self.assertIn("ramal", str(ctx.exception))

    def test_luminaria_old_mode_requires_km_luminaria(self):
        serializer = self.make_serializer()

        attrs: dict[str, Any] = {
            "alcance": "LUMINARIA",
            "ramal": "A",
            "km_luminaria": None,
            "codigos_luminarias": [],
        }

        with self.assertRaises(serializers.ValidationError) as ctx:
            serializer.validate(attrs)

        self.assertIn("km_luminaria", str(ctx.exception))

    def test_luminaria_old_mode_uses_first_code_from_list(self):
        serializer = self.make_serializer()

        attrs: dict[str, Any] = {
            "alcance": "LUMINARIA",
            "ramal": "A",
            "km_luminaria": 150.0,
            "codigo_luminaria": "",
            "codigos_luminarias": ["pc4026", "PC4026", "cc4105"],
        }

        out = cast(dict[str, Any], serializer.validate(attrs))

        self.assertEqual(out["codigos_luminarias"], ["PC4026", "CC4105"])
        self.assertEqual(out["codigo_luminaria"], "PC4026")

    def test_luminaria_old_mode_normalizes_flat_code(self):
        serializer = self.make_serializer()

        attrs: dict[str, Any] = {
            "alcance": "LUMINARIA",
            "ramal": "A",
            "km_luminaria": 150.0,
            "codigo_luminaria": "pc4026",
            "codigos_luminarias": [],
        }

        out = cast(dict[str, Any], serializer.validate(attrs))

        self.assertEqual(out["codigo_luminaria"], "PC4026")

    def test_luminaria_new_mode_requires_group_tablero(self):
        serializer = self.make_serializer(
            {
                "luminarias_por_tablero": [
                    {"ramal": "A", "items": [{"codigo_luminaria": "PC4026"}]}
                ]
            }
        )

        attrs: dict[str, Any] = {
            "alcance": "LUMINARIA",
            "luminarias_por_tablero": [
                {
                    "tablero": None,
                    "ramal": "A",
                    "items": [{"codigo_luminaria": "PC4026"}],
                }
            ],
            "codigos_luminarias": [],
        }

        with self.assertRaises(serializers.ValidationError) as ctx:
            serializer.validate(attrs)

        self.assertIn("luminarias_por_tablero", str(ctx.exception))

    def test_luminaria_new_mode_requires_group_ramal(self):
        serializer = self.make_serializer(
            {
                "luminarias_por_tablero": [
                    {
                        "tablero": str(self.tablero.pk),
                        "items": [{"codigo_luminaria": "PC4026"}],
                    }
                ]
            }
        )

        attrs: dict[str, Any] = {
            "alcance": "LUMINARIA",
            "luminarias_por_tablero": [
                {
                    "tablero": self.tablero,
                    "ramal": "",
                    "items": [{"codigo_luminaria": "PC4026"}],
                }
            ],
            "codigos_luminarias": [],
        }

        with self.assertRaises(serializers.ValidationError) as ctx:
            serializer.validate(attrs)

        self.assertIn("luminarias_por_tablero", str(ctx.exception))

    def test_luminaria_new_mode_requires_items(self):
        serializer = self.make_serializer(
            {
                "luminarias_por_tablero": [
                    {"tablero": str(self.tablero.pk), "ramal": "A"}
                ]
            }
        )

        attrs: dict[str, Any] = {
            "alcance": "LUMINARIA",
            "luminarias_por_tablero": [
                {
                    "tablero": self.tablero,
                    "ramal": "A",
                    "items": [],
                }
            ],
            "codigos_luminarias": [],
        }

        with self.assertRaises(serializers.ValidationError) as ctx:
            serializer.validate(attrs)

        self.assertIn("luminarias_por_tablero", str(ctx.exception))

    def test_luminaria_new_mode_rejects_invalid_code(self):
        serializer = self.make_serializer(
            {
                "luminarias_por_tablero": [
                    {"tablero": str(self.tablero.pk), "ramal": "A"}
                ]
            }
        )

        attrs: dict[str, Any] = {
            "alcance": "LUMINARIA",
            "luminarias_por_tablero": [
                {
                    "tablero": self.tablero,
                    "ramal": "A",
                    "items": [{"codigo_luminaria": "codigo-malo"}],
                }
            ],
            "codigos_luminarias": [],
        }

        with self.assertRaises(serializers.ValidationError) as ctx:
            serializer.validate(attrs)

        self.assertIn("código inválido", str(ctx.exception))

    def test_luminaria_new_mode_rejects_duplicate_codes(self):
        serializer = self.make_serializer(
            {
                "luminarias_por_tablero": [
                    {"tablero": str(self.tablero.pk), "ramal": "A"}
                ]
            }
        )

        attrs: dict[str, Any] = {
            "alcance": "LUMINARIA",
            "luminarias_por_tablero": [
                {
                    "tablero": self.tablero,
                    "ramal": "A",
                    "items": [
                        {"codigo_luminaria": "pc4026"},
                        {"codigo_luminaria": "PC4026"},
                    ],
                }
            ],
            "codigos_luminarias": [],
        }

        with self.assertRaises(serializers.ValidationError) as ctx:
            serializer.validate(attrs)

        self.assertIn("código repetido", str(ctx.exception))

    def test_luminaria_new_mode_normalizes_codes_and_cleans_flat_fields(self):
        serializer = self.make_serializer(
            {
                "luminarias_por_tablero": [
                    {"tablero": str(self.tablero.pk), "ramal": "A"}
                ]
            }
        )

        attrs: dict[str, Any] = {
            "alcance": "LUMINARIA",
            "ramal": "A",
            "km_luminaria": 200.0,
            "codigo_luminaria": "PC9999",
            "codigos_luminarias": ["PC9999", "CC4105"],
            "luminaria_equipos": "PC9999, CC4105",
            "luminarias_por_tablero": [
                {
                    "tablero": self.tablero,
                    "ramal": "A",
                    "items": [
                        {"codigo_luminaria": "pc4026"},
                        {"codigo_luminaria": "cc4105"},
                    ],
                }
            ],
        }

        out = cast(dict[str, Any], serializer.validate(attrs))

        self.assertEqual(out["codigos_luminarias"], [])
        self.assertEqual(out["codigo_luminaria"], "")
        self.assertEqual(out["luminaria_equipos"], "")
        self.assertEqual(out["ramal"], "")
        self.assertIsNone(out["km_luminaria"])

        grupos = cast(list[dict[str, Any]], out["luminarias_por_tablero"])
        items = cast(list[dict[str, Any]], grupos[0]["items"])
        self.assertEqual(items[0]["codigo_luminaria"], "PC4026")
        self.assertEqual(items[1]["codigo_luminaria"], "CC4105")


class OrdenTrabajoLuminariaGrupoSerializerTests(TestCase):
    def setUp(self):
        self.tablero = Tablero.objects.create(
            nombre="TC20 Septiembre",
            zona="Zona 1",
        )

    def test_group_serializer_resolves_tablero_by_exact_name(self):
        serializer = OrdenTrabajoLuminariaGrupoSerializer(
            data={"tablero": "TC20 Septiembre"}
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        data = cast(dict[str, Any], serializer.validated_data)
        self.assertEqual(data["tablero"], self.tablero)

    def test_group_serializer_resolves_tablero_by_iexact_name(self):
        serializer = OrdenTrabajoLuminariaGrupoSerializer(
            data={"tablero": "tc20 septiembre"}
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        data = cast(dict[str, Any], serializer.validated_data)
        self.assertEqual(data["tablero"], self.tablero)

    def test_group_serializer_accepts_tablero_id(self):
        serializer = OrdenTrabajoLuminariaGrupoSerializer(
            data={"tablero_id": self.tablero.pk}
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        data = cast(dict[str, Any], serializer.validated_data)
        self.assertEqual(data["tablero"], self.tablero)
