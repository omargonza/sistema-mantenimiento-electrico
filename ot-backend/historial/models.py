from django.db import models


class Tablero(models.Model):
    nombre = models.CharField(max_length=120, unique=True)
    zona = models.CharField(max_length=120)

    class Meta:
        ordering = ["nombre"]
        indexes = [
            models.Index(fields=["nombre"]),
            models.Index(fields=["zona"]),
        ]

    def __str__(self):
        return f"{self.nombre} ({self.zona})"


class HistorialTarea(models.Model):
    tablero = models.ForeignKey(
        Tablero,
        on_delete=models.CASCADE,
        related_name="historial",
    )

    fecha = models.DateField()
    creado = models.DateTimeField(auto_now_add=True)

    zona = models.CharField(max_length=200, blank=True, default="")
    circuito = models.CharField(max_length=120, blank=True, null=True)

    # === ANALÍTICA (clave) ===
    tarea_realizada = models.TextField(blank=True, default="")
    tarea_pedida = models.TextField(blank=True, default="")
    tarea_pendiente = models.TextField(blank=True, default="")

    # === SOLO UI / LEGADO ===
    descripcion = models.TextField(blank=True, default="")

    # === Anti-duplicado PRO ===
    fingerprint = models.CharField(max_length=64, default="", db_index=True)

    class Meta:
        ordering = ["-fecha", "-creado"]
        indexes = [
            models.Index(fields=["tablero", "fecha"]),
            models.Index(fields=["fingerprint"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["tablero", "fecha", "fingerprint"],
                name="uniq_hist_tablero_fecha_fp",
            )
        ]

    def __str__(self):
        return f"{self.tablero.nombre} - {self.fecha}"
