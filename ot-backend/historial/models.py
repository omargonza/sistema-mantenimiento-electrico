from django.db import models


class Tablero(models.Model):
    nombre = models.CharField(max_length=120, unique=True)
    zona = models.CharField(max_length=120)

    class Meta:
        ordering = ["nombre"]

    def __str__(self):
        return f"{self.nombre} ({self.zona})"


class HistorialTarea(models.Model):
    tablero = models.ForeignKey(
        Tablero,
        on_delete=models.CASCADE,
        related_name="historial"
    )
    circuito = models.CharField(max_length=120, blank=True, null=True)
    fecha = models.DateField()
    descripcion = models.TextField()

    class Meta:
        ordering = ["-fecha"]
        indexes = [
            models.Index(fields=["tablero", "fecha"]),
        ]

    def __str__(self):
        return f"{self.tablero.nombre} - {self.fecha}"
