from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import OrdenTrabajo
from historial.services import registrar_historial_desde_ot


@receiver(post_save, sender=OrdenTrabajo)
def registrar_historial_al_crear_ot(
    sender, instance: OrdenTrabajo, created: bool, **kwargs
):
    if not created:
        return

    try:
        registrar_historial_desde_ot(
            {
                "tablero": instance.tablero,
                "zona": instance.zona,
                "circuito": instance.circuito,
                "fecha": instance.fecha,
                "tarea_realizada": instance.tarea_realizada,
                "tarea_pedida": instance.tarea_pedida,
                "tarea_pendiente": instance.tarea_pendiente,
            }
        )
    except Exception as e:
        print("ERROR HISTORIAL (signal):", e)
