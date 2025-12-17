from io import BytesIO
import os
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether, PageBreak
)


# =========================
# TEMA PREMIUM (DUAL MODE)
# =========================
def get_theme(data):
    PRINT_MODE = bool((data or {}).get("print_mode"))

    if PRINT_MODE:
        # ---- MODO IMPRESIÓN (B/N seguro) ----
        return {
            "bg": colors.white,
            "panel": colors.whitesmoke,
            "panel2": colors.HexColor("#f6f6f6"),
            "text": colors.black,
            "muted": colors.HexColor("#555555"),
            "primary": colors.black,
            "primary2": colors.black,
            "border": colors.HexColor("#999999"),
            "row_alt": colors.HexColor("#f0f0f0"),
            "chip_bg": colors.white,
            "chip_text": colors.black,
            "pill_border": colors.HexColor("#999999"),
            "prose_bg": colors.white,
        }
    else:
        # ---- MODO PANTALLA (oscuro premium) ----
        return {
            "bg": colors.HexColor("#020617"),
            "panel": colors.HexColor("#0f172a"),
            "panel2": colors.HexColor("#111b2e"),
            "text": colors.HexColor("#e5e7eb"),
            "muted": colors.HexColor("#9ca3af"),
            "primary": colors.HexColor("#2563eb"),
            "primary2": colors.HexColor("#38bdf8"),
            "border": colors.HexColor("#334155"),
            "row_alt": colors.HexColor("#0b1220"),
            "chip_bg": colors.HexColor("#0b1220"),
            "chip_text": colors.HexColor("#a5f3fc"),
            "pill_border": colors.HexColor("#334155"),
            "prose_bg": colors.HexColor("#0b1220"),
        }


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
    # Estilos tipográficos
    # =========================
    H2 = ParagraphStyle(
        "H2",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=12,
        textColor=theme["text"],
        spaceBefore=10,
        spaceAfter=6,
    )
    LABEL = ParagraphStyle(
        "LABEL",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=theme["muted"],
    )
    VALUE = ParagraphStyle(
        "VALUE",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9.5,
        leading=12,
        textColor=theme["text"],
    )
    BODY = ParagraphStyle(
        "BODY",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9.2,
        leading=13,
        textColor=theme["text"],
    )
    MUTED = ParagraphStyle(
        "MUTED",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=8.2,
        leading=11,
        textColor=theme["muted"],
    )
    SMALL = ParagraphStyle(
        "SMALL",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.4,
        leading=10.5,
        textColor=theme["text"],
    )

    def safe(v):
        return "" if v is None else str(v)

    def P(txt, style=BODY):
        return Paragraph(safe(txt).replace("\n", "<br/>"), style)

    def now_iso():
        return datetime.now().strftime("%Y-%m-%d %H:%M")

    # =========================
    # Helper: Card (panel)
    # =========================
    def card(elements, pad=10):
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
    # Helper: bloque texto (prose)
    # =========================
    def bloque_texto(titulo, valor, empty="-"):
        contenido = safe(valor).strip() or empty
        inner = Table([[P(contenido, BODY)]], colWidths=[doc.width - 18])
        inner.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), theme["prose_bg"]),
                    ("BOX", (0, 0), (-1, -1), 1, theme["border"]),
                    ("LEFTPADDING", (0, 0), (-1, -1), 9),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 9),
                    ("TOPPADDING", (0, 0), (-1, -1), 8),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        return KeepTogether([Paragraph(titulo.upper(), H2), inner, Spacer(1, 6)])

    # =========================
    # Helper: línea para firma
    # =========================
    def linea_firma(titulo, nombre="", doc_id=""):
        # Grilla con línea y aclaración
        nombre = safe(nombre).strip()
        doc_id = safe(doc_id).strip()

        # "línea" como celda con borde inferior
        line = Table([[P(" ", SMALL)]], colWidths=[doc.width * 0.55])
        line.setStyle(TableStyle([
            ("LINEBELOW", (0,0), (-1,-1), 1, theme["border"]),
            ("BOTTOMPADDING", (0,0), (-1,-1), 8),
        ]))

        right = []
        if nombre:
            right.append(P(f"Aclaración: <b>{nombre}</b>", SMALL))
        else:
            right.append(P("Aclaración: ____________________", SMALL))

        if doc_id:
            right.append(P(f"Doc/DNI: <b>{doc_id}</b>", SMALL))
        else:
            right.append(P("Doc/DNI: ____________________", SMALL))

        block = Table(
            [[
                P(titulo.upper(), LABEL),
                line,
                right
            ]],
            colWidths=[doc.width*0.18, doc.width*0.37, doc.width*0.45],
        )
        block.setStyle(TableStyle([
            ("VALIGN", (0,0), (-1,-1), "TOP"),
            ("LEFTPADDING", (0,0), (-1,-1), 0),
            ("RIGHTPADDING", (0,0), (-1,-1), 0),
            ("TOPPADDING", (0,0), (-1,-1), 2),
            ("BOTTOMPADDING", (0,0), (-1,-1), 2),
        ]))
        return block

    story = []

    # =========================
    # RESUMEN (card) — incluye vehículo y km si vienen
    # =========================
    km_ini = safe(data.get("km_ini") or data.get("kmIni")).strip()
    km_fin = safe(data.get("km_fin") or data.get("kmFin")).strip()
    vehiculo = safe(data.get("vehiculo")).strip()

    km_text = ""
    if km_ini or km_fin:
        km_text = f"{km_ini or '-'} → {km_fin or '-'}"

    resumen_rows = [
        [P("FECHA", LABEL), P(safe(data.get("fecha")), VALUE),
         P("UBICACIÓN", LABEL), P(safe(data.get("ubicacion")), VALUE)],
        [P("TABLERO", LABEL), P(safe(data.get("tablero")), VALUE),
         P("CIRCUITO", LABEL), P(safe(data.get("circuito")), VALUE)],
        [P("VEHÍCULO", LABEL), P(vehiculo or "-", VALUE),
         P("KM (INI→FIN)", LABEL), P(km_text or "-", VALUE)],
    ]

    resumen = Table(
        resumen_rows,
        colWidths=[
            2.7 * cm, (doc.width / 2) - 2.7 * cm,
            3.0 * cm, (doc.width / 2) - 3.0 * cm
        ],
        hAlign="LEFT",
    )
    resumen.setStyle(TableStyle([
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("BOTTOMPADDING", (0,0), (-1,-1), 6),
        ("TOPPADDING", (0,0), (-1,-1), 2),
    ]))

    story.append(card([resumen], pad=12))
    story.append(Spacer(1, 10))

    # =========================
    # TAREAS (auditables)
    # =========================
    story.append(bloque_texto("Tarea pedida", data.get("tarea_pedida") or data.get("tareaPedida")))
    story.append(bloque_texto("Tarea realizada", data.get("tarea_realizada") or data.get("tareaRealizada")))
    story.append(bloque_texto("Tarea pendiente", data.get("tarea_pendiente") or data.get("tareaPendiente")))
    story.append(bloque_texto("Luminarias / equipos", data.get("luminaria_equipos") or data.get("luminaria")))
    story.append(Spacer(1, 6))

    # =========================
    # TÉCNICOS
    # =========================
    tecnicos = data.get("tecnicos") or []
    if tecnicos:
        story.append(Paragraph("TÉCNICOS", H2))
        rows = [[P("LEGAJO", LABEL), P("NOMBRE", LABEL)]]
        for t in tecnicos:
            rows.append([P(safe(t.get("legajo")), VALUE), P(safe(t.get("nombre")), VALUE)])

        table = Table(rows, colWidths=[4.0 * cm, doc.width - 4.0 * cm])
        table.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,0), theme["panel2"]),
            ("TEXTCOLOR", (0,0), (-1,0), theme["muted"]),
            ("BOX", (0,0), (-1,-1), 1, theme["border"]),
            ("INNERGRID", (0,0), (-1,-1), 0.5, theme["border"]),
            ("ROWBACKGROUNDS", (0,1), (-1,-1), [theme["panel"], theme["row_alt"]]),
            ("LEFTPADDING", (0,0), (-1,-1), 9),
            ("RIGHTPADDING", (0,0), (-1,-1), 9),
            ("TOPPADDING", (0,0), (-1,-1), 8),
            ("BOTTOMPADDING", (0,0), (-1,-1), 8),
            ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ]))
        story.append(table)
        story.append(Spacer(1, 10))

    # =========================
    # MATERIALES
    # =========================
    materiales = data.get("materiales") or []
    if materiales:
        story.append(Paragraph("MATERIALES", H2))
        rows = [[P("MATERIAL", LABEL), P("CANT.", LABEL), P("UNIDAD", LABEL)]]
        for m in materiales:
            rows.append([P(safe(m.get("material")), VALUE), P(safe(m.get("cant")), VALUE), P(safe(m.get("unidad")), VALUE)])

        table = Table(rows, colWidths=[doc.width - 6.0 * cm, 3.0 * cm, 3.0 * cm])
        table.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,0), theme["panel2"]),
            ("TEXTCOLOR", (0,0), (-1,0), theme["muted"]),
            ("BOX", (0,0), (-1,-1), 1, theme["border"]),
            ("INNERGRID", (0,0), (-1,-1), 0.5, theme["border"]),
            ("ROWBACKGROUNDS", (0,1), (-1,-1), [theme["panel"], theme["row_alt"]]),
            ("ALIGN", (1,1), (-1,-1), "CENTER"),
            ("LEFTPADDING", (0,0), (-1,-1), 9),
            ("RIGHTPADDING", (0,0), (-1,-1), 9),
            ("TOPPADDING", (0,0), (-1,-1), 8),
            ("BOTTOMPADDING", (0,0), (-1,-1), 8),
            ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ]))
        story.append(table)
        story.append(Spacer(1, 10))

    # =========================
    # LEGAL / AUDITORÍA
    # =========================
    story.append(Paragraph("OBSERVACIONES Y CONFORMIDAD", H2))

    story.append(bloque_texto(
        "Observaciones",
        data.get("observaciones"),
        empty="(Sin observaciones)"
    ))

    conformidad = safe(data.get("conformidad")).strip() or "-"
    conf_table = Table([[P("CONFORMIDAD", LABEL), P(conformidad, VALUE)]], colWidths=[3.6*cm, doc.width-3.6*cm])
    conf_table.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), theme["panel"]),
        ("BOX", (0,0), (-1,-1), 1, theme["border"]),
        ("LEFTPADDING", (0,0), (-1,-1), 9),
        ("RIGHTPADDING", (0,0), (-1,-1), 9),
        ("TOPPADDING", (0,0), (-1,-1), 8),
        ("BOTTOMPADDING", (0,0), (-1,-1), 8),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
    ]))
    story.append(conf_table)
    story.append(Spacer(1, 10))

    # Firmas
    story.append(Paragraph("FIRMAS", H2))
    story.append(linea_firma(
        "Firma técnico",
        nombre=data.get("firma_tecnico") or "",
        doc_id=data.get("dni_tecnico") or ""
    ))
    story.append(Spacer(1, 8))
    story.append(linea_firma(
        "Firma supervisor",
        nombre=data.get("firma_supervisor") or "",
        doc_id=data.get("dni_supervisor") or ""
    ))
    story.append(Spacer(1, 10))

    # Datos de auditoría / trazabilidad
    story.append(Paragraph("DATOS DE AUDITORÍA", H2))

    id_ot = safe(data.get("id_ot") or data.get("id") or "").strip() or "-"
    audit_rows = [
        [P("ID OT", LABEL), P(id_ot, VALUE),
         P("GENERADO", LABEL), P(now_iso(), VALUE)],
        [P("ORIGEN", LABEL), P("App móvil / Formulario técnico", VALUE),
         P("SISTEMA", LABEL), P("conurbaDEV OT", VALUE)],
    ]
    audit = Table(
        audit_rows,
        colWidths=[
            2.2 * cm, (doc.width / 2) - 2.2 * cm,
            2.3 * cm, (doc.width / 2) - 2.3 * cm
        ],
    )
    audit.setStyle(TableStyle([
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("BOTTOMPADDING", (0,0), (-1,-1), 6),
        ("TOPPADDING", (0,0), (-1,-1), 2),
    ]))
    story.append(card([audit], pad=12))
    story.append(Spacer(1, 6))

    # Nota final
    story.append(Paragraph("Sistema de Mantenimiento Eléctrico — Desarrollado por conurbaDEV", MUTED))

    # =========================
    # Header/Footer por página (canvas)
    # =========================
    logo_path = os.path.join(os.path.dirname(__file__), "logo.png")

    def on_page(canv, _doc):
        canv.saveState()
        w, h = A4

        # Topbar
        canv.setFillColor(theme["bg"])
        canv.rect(0, h - 2.9 * cm, w, 2.9 * cm, stroke=0, fill=1)

        # Acento superior
        canv.setFillColor(theme["primary"])
        canv.rect(0, h - 2.9 * cm, w, 0.18 * cm, stroke=0, fill=1)

        # Logo
        if os.path.exists(logo_path):
            canv.drawImage(
                logo_path,
                1.6 * cm,
                h - 2.55 * cm,
                width=1.6 * cm,
                height=1.6 * cm,
                preserveAspectRatio=True,
                mask="auto",
            )

        # Títulos
        canv.setFillColor(theme["text"])
        canv.setFont("Helvetica-Bold", 12)
        canv.drawString(3.5 * cm, h - 1.55 * cm, "SECTOR MANTENIMIENTO ELÉCTRICO")
        canv.setFont("Helvetica", 10)
        canv.drawString(3.5 * cm, h - 2.05 * cm, "ORDEN DE TRABAJO")

        # Chips: fecha / tablero / ubicación (audit-friendly)
        fecha = safe(data.get("fecha")).strip()
        tablero = safe(data.get("tablero")).strip()
        ubic = safe(data.get("ubicacion")).strip()

        chips = []
        if fecha:
            chips.append(f"FECHA: {fecha}")
        if tablero:
            chips.append(f"TABLERO: {tablero}")
        if ubic:
            chips.append(f"UBICACIÓN: {ubic}")

        if chips:
            # Dibujar 1 o 2 chips máximos por espacio (prioridad: fecha, tablero)
            chips = chips[:2]
            chip_w = 6.1 * cm
            chip_h = 0.70 * cm
            x = w - 1.6 * cm - chip_w
            y0 = h - 1.75 * cm

            for i, text in enumerate(chips):
                y = y0 - (i * (chip_h + 0.18 * cm))
                canv.setFillColor(theme["chip_bg"])
                canv.setStrokeColor(theme["pill_border"])
                canv.roundRect(x, y, chip_w, chip_h, 10, stroke=1, fill=1)
                canv.setFillColor(theme["chip_text"])
                canv.setFont("Helvetica-Bold", 8.2)
                canv.drawCentredString(x + chip_w / 2, y + 0.22 * cm, text)

        # Footer + paginado
        canv.setFillColor(theme["muted"])
        canv.setFont("Helvetica-Oblique", 8)
        canv.drawString(1.6 * cm, 1.2 * cm, "Sistema de Mantenimiento Eléctrico — Desarrollado por conurbaDEV")
        canv.drawRightString(w - 1.6 * cm, 1.2 * cm, f"Página {_doc.page}")

        canv.restoreState()

    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)

    return buffer.getvalue()
