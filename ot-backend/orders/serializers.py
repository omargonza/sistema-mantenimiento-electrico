from rest_framework import serializers
from .models import OrdenTrabajo

class OrdenTrabajoSerializer(serializers.ModelSerializer):
    # Entradas SOLO para request (no van al modelo)
    firma_tecnico_img = serializers.CharField(required=False, allow_blank=True, write_only=True)
    fotos_b64 = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        write_only=True
    )
    print_mode = serializers.BooleanField(required=False, write_only=True)

    class Meta:
        model = OrdenTrabajo
        fields = "__all__"

    def validate_fotos_b64(self, value):
        if not value:
            return []
        if len(value) > 4:
            raise serializers.ValidationError("Máximo 4 fotos.")
        # límite simple anti-bomba (ajustable)
        for i, s in enumerate(value):
            if s and len(s) > 2_000_000:
                raise serializers.ValidationError(f"Foto {i+1} demasiado grande. Comprimila antes de enviar.")
        return value
