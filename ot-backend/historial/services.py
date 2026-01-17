# historial/services.py
from datetime import date
from django.utils.dateparse import parse_date
from hashlib import sha256
import re

from .models import Tablero, HistorialTarea


# =========================================================
# NORMALIZACIÓN TABLERO (anti duplicados por variantes)
# =========================================================
def _canon_tablero(nombre: str) -> str:
    s = (nombre or "").strip()
    s = re.sub(r"\s+", " ", s)
    s = s.replace("–", "-").replace("—", "-")
    return s


def _resolve_tablero(nombre_tablero: str, zona_ot: str):
    """
    - Si existe Tablero por nombre (case-insensitive): usarlo tal cual.
    - Si no existe: crear con nombre canónico y zona del OT (o 'Sin zona').
    """
    nombre = _canon_tablero(nombre_tablero)
    if not nombre:
        return None

    t = (
        Tablero.objects.filter(nombre__iexact=nombre)
        .only("id", "nombre", "zona")
        .first()
    )
    if t:
        return t

    z = (zona_ot or "").strip() or "Sin zona"
    return Tablero.objects.create(nombre=nombre, zona=z)


def _as_date(v):
    if hasattr(v, "year"):
        return v if not hasattr(v, "date") else v.date()
    s = (str(v or "")).strip()
    return parse_date(s) if s else None


def _norm_text(s: str) -> str:
    s = (str(s or "")).strip().lower()
    s = re.sub(r"\s+", " ", s)
    s = s.replace("–", "-").replace("—", "-")
    return s


def registrar_historial_desde_ot(data):
    data = data or {}

    # === TABLERO (obligatorio) ===
    nombre_tablero = str(data.get("tablero") or "").strip()
    if not nombre_tablero:
        return

    zona_ot = str(data.get("zona") or "").strip()
    circuito_raw = str(data.get("circuito") or "").strip()
    circuito = circuito_raw or None

    fecha = _as_date(data.get("fecha")) or date.today()

    tarea_realizada = str(data.get("tarea_realizada") or "").strip()
    tarea_pedida = str(data.get("tarea_pedida") or "").strip()
    tarea_pendiente = str(data.get("tarea_pendiente") or "").strip()

    # UI summary (NO analítica)
    descripcion = (
        tarea_realizada or tarea_pedida or tarea_pendiente or "Trabajo realizado"
    )

    # ✅ Tablero consistente (anti duplicados por variantes)
    tablero = _resolve_tablero(nombre_tablero, zona_ot)
    if not tablero:
        return

    # ✅ ZONA: guardar SIEMPRE la del Tablero (source of truth)
    zona_hist = (tablero.zona or "").strip() or "Sin zona"

    # === FINGERPRINT (anti reenvío / offline) ===
    # Nota: usamos tablero.nombre resuelto + zona_hist para consistencia.
    base = "|".join(
        [
            _norm_text(tablero.nombre),
            _norm_text(zona_hist),
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
        zona=zona_hist,  # ✅ SIEMPRE Tablero.zona
        circuito=circuito,
        tarea_realizada=tarea_realizada,
        tarea_pedida=tarea_pedida,
        tarea_pendiente=tarea_pendiente,
        descripcion=descripcion[:500],
        fingerprint=fingerprint,
    )
