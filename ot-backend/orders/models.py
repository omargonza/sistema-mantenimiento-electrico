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
