from django.db import models
from historial.models import Tablero


RAMAL_CHOICES = [
    ("ACC_NORTE", "Acc Norte"),
    ("CAMPANA", "Campana"),
    ("PILAR", "Pilar"),
    ("ACC_TIGRE", "Acc Tigre"),
    ("GRAL_PAZ", "Gral Paz"),
]


class OrdenTrabajo(models.Model):
    fecha = models.DateField()
    ubicacion = models.CharField(max_length=200, blank=True, default="")

    tablero = models.CharField(max_length=100)
    zona = models.CharField(max_length=200, blank=True, default="")

    circuito = models.CharField(max_length=100, blank=True)
    vehiculo = models.CharField(max_length=50, blank=True)

    km_inicial = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )
    km_final = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )
    km_total = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )

    # =========================
    # LUMINARIAS — ubicación mínima para mapa
    # =========================
    ramal = models.CharField(
        max_length=20,
        choices=RAMAL_CHOICES,
        blank=True,
        default="",
        db_index=True,
    )
    km_luminaria = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True,
        db_index=True,
    )

    # Código operativo visible (ej: CC4105)
    codigo_luminaria = models.CharField(
        max_length=30,
        blank=True,
        default="",
        db_index=True,
    )
    # Lista canónica de luminarias (PC4026, PC4027, ...)
    # Fuente: frontend (codigos_luminarias) o parseo del texto como fallback
    codigos_luminarias = models.JSONField(default=list, blank=True, db_index=False)

    tecnicos = models.JSONField(default=list)
    materiales = models.JSONField(default=list)

    tarea_pedida = models.TextField(blank=True)
    tarea_realizada = models.TextField(blank=True)
    tarea_pendiente = models.TextField(blank=True)
    luminaria_equipos = models.TextField(blank=True)

    creado = models.DateTimeField(auto_now_add=True)
    # Auditoría / Legal
    observaciones = models.TextField(blank=True)
    firma_tecnico = models.CharField(max_length=120, blank=True)
    firma_supervisor = models.CharField(max_length=120, blank=True)

    # Evidencias (guardamos paths en disco, no base64)
    fotos = models.JSONField(default=list, blank=True)  # lista de paths
    firma_tecnico_path = models.CharField(max_length=300, blank=True)
    # =========================
    # Clasificación (Semáforo)
    # =========================
    alcance = models.CharField(max_length=20, blank=True, default="LUMINARIA")
    resultado = models.CharField(max_length=20, blank=True, default="COMPLETO")

    # Solo aplica si alcance es TABLERO o CIRCUITO
    estado_tablero = models.CharField(max_length=20, blank=True, default="")

    # Solo aplica si alcance es LUMINARIA
    luminaria_estado = models.CharField(max_length=20, blank=True, default="")

    from historial.models import Tablero


class OrdenTrabajoLuminariaGrupo(models.Model):
    ot = models.ForeignKey(
        "OrdenTrabajo",
        on_delete=models.CASCADE,
        related_name="luminaria_grupos",
    )

    tablero = models.ForeignKey(
        Tablero,
        on_delete=models.PROTECT,
        related_name="ot_luminaria_grupos",
    )

    orden = models.PositiveIntegerField(default=0)

    zona = models.CharField(max_length=200, blank=True, default="")
    circuito = models.CharField(max_length=100, blank=True, default="")
    ramal = models.CharField(
        max_length=20,
        choices=RAMAL_CHOICES,
        blank=True,
        default="",
        db_index=True,
    )

    resultado = models.CharField(max_length=20, blank=True, default="COMPLETO")
    luminaria_estado = models.CharField(max_length=20, blank=True, default="")

    tarea_pedida = models.TextField(blank=True, default="")
    tarea_realizada = models.TextField(blank=True, default="")
    tarea_pendiente = models.TextField(blank=True, default="")
    observaciones = models.TextField(blank=True, default="")

    creado = models.DateTimeField(auto_now_add=True)
    actualizado = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["orden", "id"]
        indexes = [
            models.Index(fields=["ot"]),
            models.Index(fields=["tablero"]),
            models.Index(fields=["ramal"]),
        ]

    def __str__(self):
        return f"OT {self.ot_id} - {self.tablero.nombre}"


class OrdenTrabajoLuminariaItem(models.Model):
    grupo = models.ForeignKey(
        OrdenTrabajoLuminariaGrupo,
        on_delete=models.CASCADE,
        related_name="items",
    )

    orden = models.PositiveIntegerField(default=0)

    codigo_luminaria = models.CharField(max_length=30, db_index=True)
    km_luminaria = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True,
        db_index=True,
    )

    creado = models.DateTimeField(auto_now_add=True)
    actualizado = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["orden", "id"]
        indexes = [
            models.Index(fields=["grupo"]),
            models.Index(fields=["codigo_luminaria"]),
            models.Index(fields=["km_luminaria"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["grupo", "codigo_luminaria"],
                name="uniq_grupo_codigo_luminaria",
            )
        ]

    def __str__(self):
        return f"{self.codigo_luminaria} ({self.grupo.tablero.nombre})"
