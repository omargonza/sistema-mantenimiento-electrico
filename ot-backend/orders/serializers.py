import re
from rest_framework import serializers

from historial.models import Tablero

from .models import (
    OrdenTrabajo,
    OrdenTrabajoLuminariaGrupo,
    OrdenTrabajoLuminariaItem,
    RAMAL_CHOICES,
)

# Extrae códigos tipo: PC4026, CC4105, GP0012, etc.
CODE_RE = re.compile(r"\b[A-Z]{1,4}\d{3,6}\b")


class OrdenTrabajoLuminariaItemSerializer(serializers.ModelSerializer):
    km_luminaria = serializers.FloatField(required=False, allow_null=True)

    class Meta:
        model = OrdenTrabajoLuminariaItem
        fields = [
            "id",
            "orden",
            "codigo_luminaria",
            "km_luminaria",
        ]


class OrdenTrabajoLuminariaGrupoSerializer(serializers.Serializer):
    # Puede venir id directo
    tablero_id = serializers.PrimaryKeyRelatedField(
        queryset=Tablero.objects.all(),
        source="tablero_obj",
        required=False,
        allow_null=True,
    )

    # O puede venir el nombre del tablero desde el frontend
    tablero = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
        write_only=True,
    )

    zona = serializers.CharField(required=False, allow_blank=True, default="")
    circuito = serializers.CharField(required=False, allow_blank=True, default="")
    ramal = serializers.ChoiceField(
        choices=RAMAL_CHOICES,
        required=False,
        allow_blank=True,
        default="",
    )
    resultado = serializers.CharField(
        required=False,
        allow_blank=True,
        default="COMPLETO",
    )
    luminaria_estado = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
    )
    tarea_pedida = serializers.CharField(required=False, allow_blank=True, default="")
    tarea_realizada = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
    )
    tarea_pendiente = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
    )
    observaciones = serializers.CharField(required=False, allow_blank=True, default="")
    items = OrdenTrabajoLuminariaItemSerializer(many=True, required=False)

    def validate(self, attrs):
        """
        Acepta:
        - tablero_id (preferido)
        - o tablero por nombre exacto/iexact
        """
        tablero_obj = attrs.get("tablero_obj")
        tablero_nombre = str(attrs.get("tablero") or "").strip()

        if not tablero_obj and tablero_nombre:
            tablero_obj = Tablero.objects.filter(nombre__iexact=tablero_nombre).first()

        # Normalizamos todo a la key final 'tablero'
        attrs["tablero"] = tablero_obj
        attrs.pop("tablero_obj", None)

        return attrs


class OrdenTrabajoSerializer(serializers.ModelSerializer):
    # Entradas SOLO request (no van al modelo)
    firma_tecnico_img = serializers.CharField(
        required=False,
        allow_blank=True,
        write_only=True,
    )
    fotos_b64 = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        write_only=True,
    )
    print_mode = serializers.BooleanField(required=False, write_only=True)

    codigos_luminarias = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        allow_empty=True,
    )

    luminarias_por_tablero = OrdenTrabajoLuminariaGrupoSerializer(
        many=True,
        required=False,
        write_only=True,
    )

    class Meta:
        model = OrdenTrabajo
        # IMPORTANTE:
        # NO usamos "__all__" para no exponer created_by
        fields = [
            "id",
            "fecha",
            "ubicacion",
            "tablero",
            "zona",
            "circuito",
            "vehiculo",
            "km_inicial",
            "km_final",
            "km_total",
            "ramal",
            "km_luminaria",
            "codigo_luminaria",
            "codigos_luminarias",
            "tecnicos",
            "materiales",
            "tarea_pedida",
            "tarea_realizada",
            "tarea_pendiente",
            "luminaria_equipos",
            "creado",
            "observaciones",
            "firma_tecnico",
            "firma_supervisor",
            "fotos",
            "firma_tecnico_path",
            "alcance",
            "resultado",
            "estado_tablero",
            "luminaria_estado",
            "firma_tecnico_img",
            "fotos_b64",
            "print_mode",
            "luminarias_por_tablero",
        ]
        read_only_fields = [
            "id",
            "creado",
            "fotos",
            "firma_tecnico_path",
        ]
        extra_kwargs = {
            "ubicacion": {"required": False, "allow_blank": True},
            "ramal": {"required": False, "allow_blank": True},
            "codigo_luminaria": {"required": False, "allow_blank": True},
            "km_luminaria": {"required": False, "allow_null": True},
            "zona": {"required": False, "allow_blank": True},
            "circuito": {"required": False, "allow_blank": True},
            "vehiculo": {"required": False, "allow_blank": True},
            "tarea_pedida": {"required": False, "allow_blank": True},
            "tarea_realizada": {"required": False, "allow_blank": True},
            "tarea_pendiente": {"required": False, "allow_blank": True},
            "luminaria_equipos": {"required": False, "allow_blank": True},
            "observaciones": {"required": False, "allow_blank": True},
            "firma_tecnico": {"required": False, "allow_blank": True},
            "firma_supervisor": {"required": False, "allow_blank": True},
            "alcance": {"required": False, "allow_blank": True},
            "resultado": {"required": False, "allow_blank": True},
            "estado_tablero": {"required": False, "allow_blank": True},
            "luminaria_estado": {"required": False, "allow_blank": True},
        }

    def validate_fotos_b64(self, value):
        if not value:
            return []
        if len(value) > 4:
            raise serializers.ValidationError("Máximo 4 fotos.")
        for i, s in enumerate(value):
            if s and len(s) > 2_000_000:
                raise serializers.ValidationError(
                    f"Foto {i+1} demasiado grande. Comprimila antes de enviar."
                )
        return value

    def validate_tecnicos(self, value):
        if value in (None, "", []):
            return []

        if not isinstance(value, list):
            raise serializers.ValidationError("tecnicos debe ser una lista de objetos.")

        out = []
        for i, t in enumerate(value, start=1):
            if not isinstance(t, dict):
                raise serializers.ValidationError(f"Técnico {i}: formato inválido.")

            legajo = str(t.get("legajo") or "").strip()
            nombre = str(t.get("nombre") or "").strip()

            if not legajo:
                raise serializers.ValidationError(
                    f"Técnico {i}: 'legajo' es obligatorio."
                )

            if not nombre:
                raise serializers.ValidationError(
                    f"Técnico {i}: 'nombre' es obligatorio."
                )

            out.append(
                {
                    "legajo": legajo,
                    "nombre": nombre,
                }
            )

        return out

    def validate_materiales(self, value):
        if value in (None, "", []):
            return []

        if not isinstance(value, list):
            raise serializers.ValidationError(
                "materiales debe ser una lista de objetos."
            )

        out = []
        for i, m in enumerate(value, start=1):
            if not isinstance(m, dict):
                raise serializers.ValidationError(f"Material {i}: formato inválido.")

            material = str(m.get("material") or "").strip()
            cantidad = str(m.get("cantidad") or m.get("cant") or "").strip()
            unidad = str(m.get("unidad") or "").strip()

            if not material:
                raise serializers.ValidationError(
                    f"Material {i}: 'material' es obligatorio."
                )

            out.append(
                {
                    "material": material,
                    "cantidad": cantidad,
                    "unidad": unidad,
                }
            )

        return out

    def validate(self, attrs):
        """
        Reglas:
        - Si alcance=LUMINARIA:
            * modo nuevo: usa luminarias_por_tablero
            * modo viejo: ramal + km_luminaria obligatorios
        - Si NO es LUMINARIA:
            * limpiar todo lo específico
        """
        alcance = str(attrs.get("alcance") or "").strip().upper()

        # normalizar codigo_luminaria (compat)
        if "codigo_luminaria" in attrs and attrs["codigo_luminaria"] is not None:
            attrs["codigo_luminaria"] = str(attrs["codigo_luminaria"]).strip().upper()

        # normalizar lista codigos_luminarias
        raw_list = attrs.get("codigos_luminarias", None)
        if raw_list is None:
            raw_list = []

        clean = []
        seen = set()
        for x in raw_list:
            c = str(x or "").strip().upper()
            if not c:
                continue
            if c in seen:
                continue
            seen.add(c)
            clean.append(c)

        attrs["codigos_luminarias"] = clean

        initial_groups = []
        if hasattr(self, "initial_data"):
            maybe_groups = self.initial_data.get("luminarias_por_tablero")
            if isinstance(maybe_groups, list):
                initial_groups = maybe_groups

        requested_new_mode = alcance == "LUMINARIA" and len(initial_groups) > 0
        luminarias_por_tablero = attrs.get("luminarias_por_tablero") or []

        if alcance == "LUMINARIA":
            # =========================
            # MODO NUEVO: grupos por tablero
            # =========================
            if requested_new_mode or luminarias_por_tablero:
                if not isinstance(luminarias_por_tablero, list):
                    raise serializers.ValidationError(
                        {"luminarias_por_tablero": "Formato inválido."}
                    )

                if not luminarias_por_tablero:
                    raise serializers.ValidationError(
                        {
                            "luminarias_por_tablero": (
                                "No se pudo validar ningún grupo de luminarias."
                            )
                        }
                    )

                for i, grupo in enumerate(luminarias_por_tablero):
                    tablero = grupo.get("tablero")
                    if not tablero:
                        raise serializers.ValidationError(
                            {
                                "luminarias_por_tablero": (
                                    f"Grupo {i+1}: tablero obligatorio."
                                )
                            }
                        )

                    ramal = str(grupo.get("ramal") or "").strip()
                    if not ramal:
                        raise serializers.ValidationError(
                            {
                                "luminarias_por_tablero": (
                                    f"Grupo {i+1}: ramal obligatorio."
                                )
                            }
                        )

                    items = grupo.get("items") or []
                    if not items:
                        raise serializers.ValidationError(
                            {
                                "luminarias_por_tablero": (
                                    f"Grupo {i+1}: cargá al menos una luminaria."
                                )
                            }
                        )

                    seen_codes = set()
                    for j, item in enumerate(items):
                        codigo = str(item.get("codigo_luminaria") or "").strip().upper()
                        if not codigo:
                            raise serializers.ValidationError(
                                {
                                    "luminarias_por_tablero": (
                                        f"Grupo {i+1}, item {j+1}: código obligatorio."
                                    )
                                }
                            )

                        if not CODE_RE.match(codigo):
                            raise serializers.ValidationError(
                                {
                                    "luminarias_por_tablero": (
                                        f"Grupo {i+1}, item {j+1}: "
                                        f"código inválido ({codigo})."
                                    )
                                }
                            )

                        if codigo in seen_codes:
                            raise serializers.ValidationError(
                                {
                                    "luminarias_por_tablero": (
                                        f"Grupo {i+1}: código repetido ({codigo})."
                                    )
                                }
                            )

                        seen_codes.add(codigo)
                        item["codigo_luminaria"] = codigo

                # si viene estructura nueva, anulamos compat vieja
                attrs["codigos_luminarias"] = []
                attrs["codigo_luminaria"] = ""
                attrs["luminaria_equipos"] = ""
                attrs["ramal"] = ""
                attrs["km_luminaria"] = None

            # =========================
            # MODO VIEJO: OT plana
            # =========================
            else:
                ramal = (attrs.get("ramal") or "").strip()
                km_lum = attrs.get("km_luminaria", None)

                if not ramal:
                    raise serializers.ValidationError(
                        {"ramal": "En LUMINARIA, el ramal es obligatorio."}
                    )

                if km_lum is None:
                    raise serializers.ValidationError(
                        {"km_luminaria": "En LUMINARIA, el KM es obligatorio."}
                    )

                if not (attrs.get("codigo_luminaria") or "").strip() and clean:
                    attrs["codigo_luminaria"] = clean[0]

                if "codigo_luminaria" in attrs and attrs["codigo_luminaria"]:
                    attrs["codigo_luminaria"] = attrs["codigo_luminaria"][:30]

        else:
            # NO luminaria: limpiar todo lo específico
            attrs["ramal"] = ""
            attrs["km_luminaria"] = None
            attrs["codigo_luminaria"] = ""
            attrs["codigos_luminarias"] = []
            attrs["luminaria_estado"] = ""
            attrs["luminaria_equipos"] = ""
            attrs["luminarias_por_tablero"] = []

        return attrs

    def validate_luminaria_equipos(self, value):
        v = (value or "").strip()
        if not v:
            return ""

        has_any_alnum = any(ch.isalnum() for ch in v)
        codes = CODE_RE.findall(v.upper())

        if has_any_alnum and not codes:
            raise serializers.ValidationError(
                "Formato inválido. Cargá códigos tipo PC4026 separados por coma."
            )

        seen = set()
        out = []
        for c in codes:
            if c in seen:
                continue
            seen.add(c)
            out.append(c)

        return ", ".join(out)
