from django.db import models

class OrdenTrabajo(models.Model):
    fecha = models.DateField()
    ubicacion = models.CharField(max_length=200)
    tablero = models.CharField(max_length=100)
    circuito = models.CharField(max_length=100, blank=True)
    vehiculo = models.CharField(max_length=50, blank=True)

    km_inicial = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    km_final = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

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
