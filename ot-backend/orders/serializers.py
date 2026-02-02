import re
from rest_framework import serializers
from .models import OrdenTrabajo

# Extrae códigos tipo: PC4026, CC4105, GP0012, etc.
CODE_RE = re.compile(r"\b[A-Z]{1,4}\d{3,6}\b")


class OrdenTrabajoSerializer(serializers.ModelSerializer):
    # Entradas SOLO request (no van al modelo)
    firma_tecnico_img = serializers.CharField(
        required=False, allow_blank=True, write_only=True
    )
    fotos_b64 = serializers.ListField(
        child=serializers.CharField(), required=False, write_only=True
    )
    print_mode = serializers.BooleanField(required=False, write_only=True)

    codigos_luminarias = serializers.ListField(
        child=serializers.CharField(), required=False, allow_empty=True
    )

    class Meta:
        model = OrdenTrabajo
        fields = "__all__"
        extra_kwargs = {
            "ubicacion": {"required": False, "allow_blank": True},
            # ✅ Luminarias: permitir vacío (cuando NO es luminaria)
            "ramal": {"required": False, "allow_blank": True},
            "codigo_luminaria": {"required": False, "allow_blank": True},
            "km_luminaria": {"required": False, "allow_null": True},
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

    def validate(self, attrs):
        """
        Reglas:
        - Si alcance=LUMINARIA:
            * ramal requerido
            * km_luminaria requerido
            * codigos_luminarias opcional pero recomendado
            * codigo_luminaria (compat) se normaliza
        - Si NO es LUMINARIA:
            * limpiar ramal/km/codigo_luminaria/codigos_luminarias/luminaria_estado/luminaria_equipos
              para evitar basura y errores max_length
        """
        alcance = str(attrs.get("alcance") or "").strip().upper()

        # normalizar codigo_luminaria (compat)
        if "codigo_luminaria" in attrs and attrs["codigo_luminaria"] is not None:
            attrs["codigo_luminaria"] = str(attrs["codigo_luminaria"]).strip().upper()

        # normalizar lista codigos_luminarias
        raw_list = attrs.get("codigos_luminarias", None)
        if raw_list is None:
            raw_list = []

        # limpiar, upper, únicos, mantener orden
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

        if alcance == "LUMINARIA":
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

            # compat: si no hay codigo_luminaria pero hay lista, setear principal
            if not (attrs.get("codigo_luminaria") or "").strip() and clean:
                attrs["codigo_luminaria"] = clean[0]

            # hard cap por tu modelo actual (max_length=30)
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

        return attrs

    def validate_luminaria_equipos(self, value):
        v = (value or "").strip()
        if not v:
            return ""

        # si hay letras/números pero no hay ningún código válido, rechazamos
        has_any_alnum = any(ch.isalnum() for ch in v)
        codes = CODE_RE.findall(v.upper())

        if has_any_alnum and not codes:
            raise serializers.ValidationError(
                "Formato inválido. Cargá códigos tipo PC4026 separados por coma."
            )

        # normalizamos a formato único
        # (preservando orden y quitando duplicados)
        seen = set()
        out = []
        for c in codes:
            if c in seen:
                continue
            seen.add(c)
            out.append(c)

        return ", ".join(out)
