from datetime import date
from django.utils.dateparse import parse_date
from hashlib import sha256
import re

from .models import Tablero, HistorialTarea


def _as_date(v):
    if hasattr(v, "year"):
        return v if not hasattr(v, "date") else v.date()
    s = (str(v or "")).strip()
    return parse_date(s) if s else None


def _norm_text(s: str) -> str:
    s = (str(s or "")).strip().lower()
    s = re.sub(r"\s+", " ", s)
    return s


def registrar_historial_desde_ot(data):
    data = data or {}

    # === TABLERO (obligatorio) ===
    nombre_tablero = (str(data.get("tablero") or "")).strip()
    if not nombre_tablero:
        return

    zona_ot = (str(data.get("zona") or "")).strip()
    circuito_raw = (str(data.get("circuito") or "")).strip()
    circuito = circuito_raw or None

    fecha = _as_date(data.get("fecha")) or date.today()

    tarea_realizada = (str(data.get("tarea_realizada") or "")).strip()
    tarea_pedida = (str(data.get("tarea_pedida") or "")).strip()
    tarea_pendiente = (str(data.get("tarea_pendiente") or "")).strip()

    # UI summary (NO analítica)
    descripcion = (
        tarea_realizada or tarea_pedida or tarea_pendiente or "Trabajo realizado"
    )

    tablero, _ = Tablero.objects.get_or_create(
        nombre=nombre_tablero,
        defaults={"zona": zona_ot or "Sin zona"},
    )

    # === FINGERPRINT (anti reenvío / offline) ===
    base = "|".join(
        [
            _norm_text(nombre_tablero),
            _norm_text(zona_ot),
            _norm_text(circuito or ""),
            _norm_text(tarea_realizada),
            _norm_text(tarea_pedida),
            _norm_text(tarea_pendiente),
        ]
    )
    fingerprint = sha256(base.encode("utf-8")).hexdigest()

    if HistorialTarea.objects.filter(
        tablero=tablero,
        fecha=fecha,
        fingerprint=fingerprint,
    ).exists():
        return

    HistorialTarea.objects.create(
        tablero=tablero,
        fecha=fecha,
        zona=zona_ot,
        circuito=circuito,
        tarea_realizada=tarea_realizada,
        tarea_pedida=tarea_pedida,
        tarea_pendiente=tarea_pendiente,
        descripcion=descripcion[:500],
        fingerprint=fingerprint,
    )
