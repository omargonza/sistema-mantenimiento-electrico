from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import Table, TableStyle
from io import BytesIO
import textwrap
import os


def generar_pdf(data):
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)

    width, height = A4
    y = height - 80

    # ============================================================
    # ENCABEZADO CON LOGO Y TITULO
    # ============================================================

    logo_path = os.path.join(os.path.dirname(__file__), "logo.png")

    if os.path.exists(logo_path):
        pdf.drawImage(logo_path, 40, y - 20, width=70, height=70, preserveAspectRatio=True)

    pdf.setFont("Helvetica-Bold", 20)
    pdf.drawString(130, y + 20, "SECTOR MANTENIMIENTO ELÉCTRICO")
    pdf.setFont("Helvetica-Bold", 14)
    pdf.drawString(130, y - 5, "ORDEN DE TRABAJO")

    y -= 90

    # ============================================================
    # FUNCION DE NUEVA PÁGINA
    # ============================================================

    def new_page():
        nonlocal y
        pdf.showPage()
        y = height - 80
        pdf.setFont("Helvetica-Bold", 14)
        pdf.drawString(40, height - 40, "SECTOR MANTENIMIENTO ELÉCTRICO")
        pdf.drawString(40, height - 60, "ORDEN DE TRABAJO")
        pdf.setFont("Helvetica", 11)

    # ============================================================
    # BLOQUE PREMIUM ELEGANTE SIN ICONOS
    # ============================================================

    box_height = 125
    box_top = y
    box_bottom = y - box_height

    # Fondo gris suave
    pdf.setFillColorRGB(0.96, 0.96, 0.96)
    pdf.roundRect(40, box_bottom, width - 80, box_height, radius=12, fill=1, stroke=0)

    # Borde azul elegante tipo Ausol
    pdf.setLineWidth(2)
    pdf.setStrokeColorRGB(0.15, 0.33, 0.61)
    pdf.roundRect(40, box_bottom, width - 80, box_height, radius=12, fill=0, stroke=1)

    # Línea inferior azul suave
    pdf.setLineWidth(4)
    pdf.setStrokeColorRGB(0.18, 0.45, 0.85)
    pdf.line(40, box_bottom, width - 40, box_bottom)

    # Restaurar estilo
    pdf.setFillColor(colors.black)
    pdf.setStrokeColor(colors.black)
    pdf.setFont("Helvetica", 12)

    y -= 25

    def draw_line(label, value, bold=False):
        nonlocal y
        pdf.setFont("Helvetica-Bold" if bold else "Helvetica", 12)
        pdf.drawString(55, y, f"{label}:")
        pdf.setFont("Helvetica", 12)
        pdf.drawString(170, y, str(value if value else ""))
        y -= 22

    draw_line("FECHA", data.get("fecha"))
    draw_line("UBICACIÓN", data.get("ubicacion"))
    draw_line("TABLERO", data.get("tablero"), bold=True)
    draw_line("CIRCUITO", data.get("circuito"))

    y = box_bottom - 25

    # ============================================================
    # TAREAS FORMATEADAS
    # ============================================================

    def draw_paragraph(label, text, indent=40, max_width=100):
        nonlocal y

        pdf.setFont("Helvetica-Bold", 12)
        pdf.drawString(indent, y, label + ":")
        y -= 16

        pdf.setFont("Helvetica", 10)
        if text:
            wrapped = textwrap.wrap(str(text), max_width)
            for line in wrapped:
                pdf.drawString(indent + 15, y, line)
                y -= 14
                if y < 100:
                    new_page()
        else:
            pdf.drawString(indent + 15, y, "-")
            y -= 14

        y -= 10

    draw_paragraph("Tarea Pedida", data.get("tarea_pedida"))
    draw_paragraph("Tarea Realizada", data.get("tarea_realizada"))
    draw_paragraph("Tarea Pendiente", data.get("tarea_pendiente"))
    draw_paragraph("Luminaria/Equipos", data.get("luminaria_equipos"))

    # ============================================================
    # TABLA DE TÉCNICOS
    # ============================================================

    tecnicos = data.get("tecnicos", [])

    if tecnicos:
        pdf.setFont("Helvetica-Bold", 12)
        pdf.drawString(40, y, "TÉCNICOS")
        y -= 25

        tabla_data = [["Legajo", "Nombre"]]

        for t in tecnicos:
            tabla_data.append([t.get("legajo", ""), t.get("nombre", "")])

        tabla = Table(tabla_data, colWidths=[4*cm, 10*cm])
        tabla.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.darkblue),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('BACKGROUND', (0,1), (-1,-1), colors.whitesmoke),
            ('GRID', (0,0), (-1,-1), 0.5, colors.black),
        ]))

        h = len(tabla_data) * 18
        tabla.wrapOn(pdf, 40, y)
        tabla.drawOn(pdf, 40, y - h)
        y -= (h + 40)

        if y < 100:
            new_page()

    # ============================================================
    # TABLA DE MATERIALES
    # ============================================================

    materiales = data.get("materiales", [])

    if materiales:
        pdf.setFont("Helvetica-Bold", 12)
        pdf.drawString(40, y, "MATERIALES")
        y -= 25

        tabla_data = [["Material", "Cantidad", "Unidad"]]

        for m in materiales:
            tabla_data.append([
                m.get("material", ""),
                m.get("cant", ""),
                m.get("unidad", "")
            ])

        tabla = Table(tabla_data, colWidths=[8*cm, 3*cm, 3*cm])
        tabla.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.yellow),
            ('TEXTCOLOR', (0,0), (-1,0), colors.black),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('ALIGN', (1,1), (-1,-1), 'CENTER'),
            ('BACKGROUND', (0,1), (-1,-1), colors.lightgrey),
            ('GRID', (0,0), (-1,-1), 0.5, colors.black),
        ]))

        h = len(tabla_data) * 18
        tabla.wrapOn(pdf, 40, y)
        tabla.drawOn(pdf, 40, y - h)
        y -= (h + 40)

    # ============================================================
    # PIE DE PÁGINA CORPORATIVO
    # ============================================================

    pdf.setFont("Helvetica-Oblique", 9)
    pdf.setFillColor(colors.grey)
    pdf.drawString(
        40, 40,
        "Sistema de Mantenimiento Eléctrico — Desarrollado por conurbaDEV"
    )

    pdf.save()
    return buffer.getvalue()
