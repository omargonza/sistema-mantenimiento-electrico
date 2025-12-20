from rest_framework import serializers
from .models import Tablero


class TableroSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tablero
        fields = ["id", "nombre", "zona"]
