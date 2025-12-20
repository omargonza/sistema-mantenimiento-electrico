from datetime import date
from .models import Tablero, HistorialTarea


def registrar_historial_desde_ot(data):
    nombre_tablero = (data.get("tablero") or "").strip()
    if not nombre_tablero:
        return

    zona = (data.get("zona") or "").strip() or "Sin zona"
    circuito = (data.get("circuito") or "").strip()

    descripcion = (
        data.get("tarea_realizada")
        or data.get("tarea_pedida")
        or "Trabajo realizado"
    )

    tablero, _ = Tablero.objects.get_or_create(
        nombre=nombre_tablero,
        defaults={"zona": zona}
    )

    hoy = date.today()

    # 🚫 Evitar duplicado mismo día + mismo circuito
    if HistorialTarea.objects.filter(
        tablero=tablero,
        fecha=hoy,
        circuito=circuito,
    ).exists():
        return

    HistorialTarea.objects.create(
        tablero=tablero,
        fecha=hoy,
        circuito=circuito,
        descripcion=descripcion[:500],
    )
