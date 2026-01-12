# orders/pdf.py
from io import BytesIO
import os
from datetime import datetime

from django.conf import settings

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    KeepTogether,
    Image,
)
from django.contrib.staticfiles import finders
from reportlab.lib.utils import ImageReader


# =========================
# TEMA PREMIUM (DUAL MODE)
# =========================
def get_theme(data):
    PRINT_MODE = bool((data or {}).get("print_mode"))

    if PRINT_MODE:
        # ---- IMPRESIÓN (B/N seguro) ----
        return {
            "bg": colors.white,
            "panel": colors.HexColor("#f7f7f7"),
            "panel2": colors.HexColor("#ededed"),
            "text": colors.black,
            "muted": colors.HexColor("#333333"),
            "border": colors.HexColor("#666666"),
            "row_alt": colors.HexColor("#f0f0f0"),
            "prose_bg": colors.white,
            "accent": colors.black,
        }

    # ---- PANTALLA (más contraste) ----
    return {
        "bg": colors.HexColor("#020617"),
        "panel": colors.HexColor("#0b1220"),
        "panel2": colors.HexColor("#0f1a2b"),
        "text": colors.HexColor("#f8fafc"),
        "muted": colors.HexColor("#cbd5e1"),
        "border": colors.HexColor("#334155"),
        "row_alt": colors.HexColor("#0a1020"),
        "prose_bg": colors.HexColor("#070d18"),
        "accent": colors.HexColor("#38bdf8"),
    }


def _abs_media(rel_path: str) -> str:
    if not rel_path:
        return ""
    return os.path.join(settings.MEDIA_ROOT, rel_path.replace("/", os.sep))


def _img_flowable(abs_path: str, w_cm: float, h_cm: float, h_align="LEFT"):
    """Crea Image si existe el archivo. Si no, devuelve None."""
    if not abs_path or not os.path.exists(abs_path):
        return None
    im = Image(abs_path, width=w_cm * cm, height=h_cm * cm)
    im.hAlign = h_align
    return im


def _static_abs(static_rel: str) -> str:
    """
    Devuelve el path absoluto real de un archivo en staticfiles.
    Funciona en desarrollo y producción (collectstatic).
    """
    p = finders.find(static_rel)
    return p or ""


def generar_pdf(data):
    data = data or {}
    theme = get_theme(data)

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=1.6 * cm,
        rightMargin=1.6 * cm,
        topMargin=3.2 * cm,
        bottomMargin=2.0 * cm,
        title="Orden de Trabajo",
        author="conurbaDEV",
    )

    styles = getSampleStyleSheet()

    # =========================
    # TIPOGRAFÍA (más legible)
    # =========================
    H2 = ParagraphStyle(
        "H2",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10.8,
        leading=13,
        textColor=theme["text"] if data.get("print_mode") else theme["muted"],
        spaceBefore=10,
        spaceAfter=6,
    )

    LABEL = ParagraphStyle(
        "LABEL",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.6,
        leading=10.5,
        textColor=theme["muted"],
    )

    VALUE = ParagraphStyle(
        "VALUE",
        parent=styles["Normal"],
        fontName="Helvetica-Bold" if not data.get("print_mode") else "Helvetica",
        fontSize=10.2,
        leading=12.8,
        textColor=theme["text"],
    )

    BODY = ParagraphStyle(
        "BODY",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9.8,
        leading=14,
        textColor=theme["text"],
    )

    MUTED = ParagraphStyle(
        "MUTED",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=8.3,
        leading=11,
        textColor=theme["muted"],
    )

    SMALL = ParagraphStyle(
        "SMALL",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.6,
        leading=10.8,
        textColor=theme["text"],
    )

    def safe(v):
        return "" if v is None else str(v)

    def P(txt, style=BODY):
        return Paragraph(safe(txt).replace("\n", "<br/>"), style)

    def now_iso():
        return datetime.now().strftime("%Y-%m-%d %H:%M")

    # =========================
    # Card (panel)
    # =========================
    def card(elements, pad=11):
        t = Table([[elements]], colWidths=[doc.width])
        t.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), theme["panel"]),
                    ("BOX", (0, 0), (-1, -1), 1, theme["border"]),
                    ("LEFTPADDING", (0, 0), (-1, -1), pad),
                    ("RIGHTPADDING", (0, 0), (-1, -1), pad),
                    ("TOPPADDING", (0, 0), (-1, -1), pad),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), pad),
                ]
            )
        )
        return t

    # =========================
    # Bloque de texto (prose)
    # =========================
    def bloque_texto(titulo, valor, empty="-"):
        contenido = safe(valor).strip() or empty
        inner = Table([[P(contenido, BODY)]], colWidths=[doc.width - 18])
        inner.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), theme["prose_bg"]),
                    ("BOX", (0, 0), (-1, -1), 1, theme["border"]),
                    ("LEFTPADDING", (0, 0), (-1, -1), 10),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                    ("TOPPADDING", (0, 0), (-1, -1), 9),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
                ]
            )
        )
        return KeepTogether([Paragraph(titulo.upper(), H2), inner, Spacer(1, 7)])

    # =========================
    # Firmas (sin DNI/DOC)
    # =========================
    def linea_firma(titulo, aclaracion=""):
        line = Table([[P(" ", SMALL)]], colWidths=[doc.width * 0.46])
        line.setStyle(
            TableStyle(
                [
                    ("LINEBELOW", (0, 0), (-1, -1), 1.4, theme["border"]),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                ]
            )
        )

        right = P(
            f"Aclaración: <b>{safe(aclaracion).strip() or '____________________'}</b>",
            SMALL,
        )

        block = Table(
            [[P(titulo.upper(), LABEL), line, right]],
            colWidths=[doc.width * 0.20, doc.width * 0.48, doc.width * 0.32],
        )
        block.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                    ("TOPPADDING", (0, 0), (-1, -1), 2),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                ]
            )
        )
        return block

    story = []

    # =========================
    # RESUMEN (card)
    # =========================
    km_ini = safe(data.get("km_inicial")).strip()
    km_fin = safe(data.get("km_final")).strip()
    vehiculo = safe(data.get("vehiculo")).strip()

    km_text = f"{km_ini or '-'} → {km_fin or '-'}" if (km_ini or km_fin) else "-"

    # ✅ KM TOTAL
    km_total = data.get("km_total")
    km_total_text = f"{km_total} km" if km_total not in (None, "", 0) else "-"

    resumen_rows = [
        [
            P("FECHA", LABEL),
            P(safe(data.get("fecha")), VALUE),
            P("UBICACIÓN", LABEL),
            P(safe(data.get("ubicacion")), VALUE),
        ],
        [
            P("TABLERO", LABEL),
            P(safe(data.get("tablero")), VALUE),
            P("CIRCUITO", LABEL),
            P(safe(data.get("circuito")), VALUE),
        ],
        [
            P("VEHÍCULO", LABEL),
            P(vehiculo or "-", VALUE),
            P("KM (INI→FIN)", LABEL),
            P(km_text, VALUE),
        ],
        [P("KM TOTAL", LABEL), P(km_total_text, VALUE), P("", LABEL), P("", VALUE)],
    ]

    resumen = Table(
        resumen_rows,
        colWidths=[
            2.7 * cm,
            (doc.width / 2) - 2.7 * cm,
            3.0 * cm,
            (doc.width / 2) - 3.0 * cm,
        ],
        hAlign="LEFT",
    )
    resumen.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )

    story.append(card([resumen], pad=12))
    story.append(Spacer(1, 11))

    # =========================
    # CLASIFICACIÓN (SEMAFORO)
    # =========================
    alcance = safe(data.get("alcance")).strip() or "-"
    resultado = safe(data.get("resultado")).strip() or "-"
    estado_tablero = safe(data.get("estado_tablero")).strip()
    luminaria_estado = safe(data.get("luminaria_estado")).strip()

    # Card compacto con 2 filas
    clasif_rows = [
        [
            P("ALCANCE", LABEL),
            P(alcance, VALUE),
            P("RESULTADO", LABEL),
            P(resultado, VALUE),
        ],
    ]

    # Condicionales según alcance
    if alcance.upper() in ("TABLERO", "CIRCUITO"):
        clasif_rows.append(
            [
                P("ESTADO TABLERO", LABEL),
                P(estado_tablero or "-", VALUE),
                P("", LABEL),
                P("", VALUE),
            ]
        )
    elif alcance.upper() == "LUMINARIA":
        clasif_rows.append(
            [
                P("ESTADO LUMINARIA", LABEL),
                P(luminaria_estado or "-", VALUE),
                P("", LABEL),
                P("", VALUE),
            ]
        )

    clasif = Table(
        clasif_rows,
        colWidths=[
            3.0 * cm,
            (doc.width / 2) - 3.0 * cm,
            3.0 * cm,
            (doc.width / 2) - 3.0 * cm,
        ],
        hAlign="LEFT",
    )
    clasif.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )

    story.append(Paragraph("CLASIFICACIÓN", H2))
    story.append(card([clasif], pad=12))
    story.append(Spacer(1, 11))

    # =========================
    # TAREAS
    # =========================
    story.append(bloque_texto("Tarea pedida", data.get("tarea_pedida")))
    story.append(bloque_texto("Tarea realizada", data.get("tarea_realizada")))
    story.append(bloque_texto("Tarea pendiente", data.get("tarea_pendiente")))
    story.append(bloque_texto("Luminarias / equipos", data.get("luminaria_equipos")))
    story.append(Spacer(1, 6))

    # =========================
    # TÉCNICOS
    # =========================
    tecnicos = data.get("tecnicos") or []
    if tecnicos:
        story.append(Paragraph("TÉCNICOS", H2))
        rows = [[P("LEGAJO", LABEL), P("NOMBRE", LABEL)]]
        for t in tecnicos:
            rows.append(
                [P(safe(t.get("legajo")), VALUE), P(safe(t.get("nombre")), VALUE)]
            )

        table = Table(rows, colWidths=[4.0 * cm, doc.width - 4.0 * cm])
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), theme["panel2"]),
                    ("TEXTCOLOR", (0, 0), (-1, 0), theme["muted"]),
                    ("BOX", (0, 0), (-1, -1), 1, theme["border"]),
                    ("INNERGRID", (0, 0), (-1, -1), 0.6, theme["border"]),
                    (
                        "ROWBACKGROUNDS",
                        (0, 1),
                        (-1, -1),
                        [theme["panel"], theme["row_alt"]],
                    ),
                    ("LEFTPADDING", (0, 0), (-1, -1), 10),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                    ("TOPPADDING", (0, 0), (-1, -1), 9),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ]
            )
        )
        story.append(table)
        story.append(Spacer(1, 11))

    # =========================
    # MATERIALES
    # =========================
    materiales = data.get("materiales") or []
    if materiales:
        story.append(Paragraph("MATERIALES", H2))
        rows = [[P("MATERIAL", LABEL), P("CANT.", LABEL), P("UNIDAD", LABEL)]]
        for m in materiales:
            rows.append(
                [
                    P(safe(m.get("material")), VALUE),
                    P(safe(m.get("cant")), VALUE),
                    P(safe(m.get("unidad")), VALUE),
                ]
            )

        table = Table(rows, colWidths=[doc.width - 6.0 * cm, 3.0 * cm, 3.0 * cm])
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), theme["panel2"]),
                    ("TEXTCOLOR", (0, 0), (-1, 0), theme["muted"]),
                    ("BOX", (0, 0), (-1, -1), 1, theme["border"]),
                    ("INNERGRID", (0, 0), (-1, -1), 0.6, theme["border"]),
                    (
                        "ROWBACKGROUNDS",
                        (0, 1),
                        (-1, -1),
                        [theme["panel"], theme["row_alt"]],
                    ),
                    ("ALIGN", (1, 1), (-1, -1), "CENTER"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 10),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                    ("TOPPADDING", (0, 0), (-1, -1), 9),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ]
            )
        )
        story.append(table)
        story.append(Spacer(1, 11))

    # =========================
    # OBSERVACIONES
    # =========================
    story.append(
        bloque_texto(
            "Observaciones", data.get("observaciones"), empty="(Sin observaciones)"
        )
    )

    # =========================
    # FIRMAS + FIRMA DIGITAL REAL
    # =========================
    story.append(Paragraph("FIRMAS", H2))

    # Firma técnica digital (path relativo guardado en DB o enviado al pdf_data)
    firma_rel = (data.get("firma_tecnico_path") or "").strip()
    firma_abs = _abs_media(firma_rel) if firma_rel else ""

    firma_img = _img_flowable(firma_abs, w_cm=7.0, h_cm=2.4)  # tamaño “premium”

    bloque_tec = [
        linea_firma("Firma técnico", aclaracion=data.get("firma_tecnico") or "")
    ]
    if firma_img:
        bloque_tec += [Spacer(1, 6), firma_img]
    story.append(KeepTogether(bloque_tec))
    story.append(Spacer(1, 10))

    story.append(
        linea_firma("Firma supervisor", aclaracion=data.get("firma_supervisor") or "")
    )
    story.append(Spacer(1, 12))

    # =========================
    # EVIDENCIAS (FOTOS) — hasta 4 (2x2)
    # =========================
    fotos_rel = data.get("fotos_paths") or data.get("fotos") or []
    fotos_rel = list(fotos_rel)[:4]

    fotos_abs = []
    for rel in fotos_rel:
        ap = _abs_media(rel)
        if ap and os.path.exists(ap):
            fotos_abs.append(ap)

    if fotos_abs:
        story.append(Paragraph("EVIDENCIAS (FOTOS)", H2))

        cells = []
        for ap in fotos_abs:
            cells.append(_img_flowable(ap, w_cm=8.2, h_cm=6.0, h_align="CENTER"))

        while len(cells) < 4:
            cells.append(Paragraph("", BODY))

        grid = Table(
            [[cells[0], cells[1]], [cells[2], cells[3]]],
            colWidths=[doc.width / 2 - 4, doc.width / 2 - 4],
        )
        grid.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 4),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ("BOX", (0, 0), (-1, -1), 1, theme["border"]),
                    ("INNERGRID", (0, 0), (-1, -1), 0.6, theme["border"]),
                    ("BACKGROUND", (0, 0), (-1, -1), theme["panel"]),
                ]
            )
        )
        story.append(grid)
        story.append(Spacer(1, 12))

    # =========================
    # DATOS DE AUDITORÍA
    # =========================
    story.append(Paragraph("DATOS DE AUDITORÍA", H2))
    id_ot = safe(data.get("id_ot") or data.get("id") or "").strip() or "-"
    audit_rows = [
        [P("ID OT", LABEL), P(id_ot, VALUE), P("GENERADO", LABEL), P(now_iso(), VALUE)],
        [
            P("ORIGEN", LABEL),
            P("App móvil / Formulario técnico", VALUE),
            P("SISTEMA", LABEL),
            P("conurbaDEV OT", VALUE),
        ],
    ]
    audit = Table(
        audit_rows,
        colWidths=[
            2.2 * cm,
            (doc.width / 2) - 2.2 * cm,
            2.3 * cm,
            (doc.width / 2) - 2.3 * cm,
        ],
    )
    audit.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    story.append(card([audit], pad=12))
    story.append(Spacer(1, 6))
    story.append(
        Paragraph(
            "Sistema de Mantenimiento Eléctrico — Desarrollado por conurbaDEV", MUTED
        )
    )

    # =========================
    # Header/Footer por página
    # =========================
    logo_path = _static_abs("orders/rayo.png")

    def on_page(canv, _doc):
        canv.saveState()
        w, h = A4

        # =========================
        # Barra superior
        # =========================
        canv.setFillColor(theme["bg"])
        canv.rect(0, h - 2.9 * cm, w, 2.9 * cm, stroke=0, fill=1)

        # =========================
        # Acento gris plomo metalizado
        # =========================
        accent_header = colors.HexColor("#9ca3af")  # plomo/acero claro
        canv.setFillColor(accent_header)
        canv.rect(0, h - 2.9 * cm, w, 0.18 * cm, stroke=0, fill=1)

        # =========================
        # Logo corporativo (rayo) — grande
        # =========================
        if logo_path and os.path.exists(logo_path):
            size = 1.85 * cm
            x = 1.6 * cm
            y = h - 2.70 * cm
            canv.drawImage(
                ImageReader(logo_path),
                x,
                y,
                width=size,
                height=size,
                preserveAspectRatio=True,
                mask="auto",
            )

        # =========================
        # Títulos
        # =========================
        canv.setFillColor(theme["text"])
        canv.setFont("Helvetica-Bold", 12)
        canv.drawString(3.5 * cm, h - 1.55 * cm, "SECTOR MANTENIMIENTO ELÉCTRICO")

        canv.setFont("Helvetica", 10)
        canv.drawString(3.5 * cm, h - 2.05 * cm, "ORDEN DE TRABAJO")

        # =========================
        # Footer
        # =========================
        canv.setFillColor(theme["muted"])
        canv.setFont("Helvetica-Oblique", 8)
        canv.drawString(
            1.6 * cm,
            1.2 * cm,
            "Sistema de Mantenimiento Eléctrico — Desarrollado por conurbaDEV",
        )
        canv.drawRightString(
            w - 1.6 * cm,
            1.2 * cm,
            f"Página {_doc.page}",
        )

        canv.restoreState()

    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    return buffer.getvalue()
