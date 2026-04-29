#!/usr/bin/env python3
"""
safety_plan_to_pdf.py — Convierte una fila de safety_plans (Supabase) en PDF firmable.

Generado en B26 con criterio del agente Document Generator de agency-agents-main.
Reescrito en B26 P4 con reportlab (Python puro, sin libs nativas) tras incidentes
con weasyprint+Docker en Windows. Reemplaza el paso humano "JSON -> Google Doc ->
exportar PDF -> firmar" por un solo comando.

Uso:
    # Modo demo (no requiere Supabase, datos dummy embebidos)
    python safety_plan_to_pdf.py --demo

    # Por safety_plan_id directo
    python safety_plan_to_pdf.py --plan-id 8a3f2b1c-...

    # Por project_id (toma el ultimo plan del proyecto)
    python safety_plan_to_pdf.py --project-id 5c230fc9-...

    # Output a fichero concreto
    python safety_plan_to_pdf.py --plan-id 8a3f2b1c-... --output mi_ebss.pdf

Dependencias:
    pip install reportlab
    pip install psycopg2-binary python-dotenv  (solo si NO usas --demo)

Variables de entorno (en .env, solo si NO usas --demo):
    SUPABASE_DB_HOST=db.xxx.supabase.co
    SUPABASE_DB_PORT=5432
    SUPABASE_DB_NAME=postgres
    SUPABASE_DB_USER=postgres.xxx
    SUPABASE_DB_PASSWORD=xxx
    STUDIO_NAME="Demo ArquitAI"           (opcional, override del studio_profile)
    STUDIO_PERSONA="Equipo ArquitAI"      (opcional)
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
from pathlib import Path

try:
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import cm, mm
    from reportlab.platypus import (
        BaseDocTemplate, Frame, KeepTogether, PageBreak, PageTemplate,
        Paragraph, Spacer, Table, TableStyle,
    )
except ImportError:
    print("ERROR: falta reportlab. Instala con: pip install reportlab", file=sys.stderr)
    sys.exit(1)


# ─────────────────────────────────────────────────────────────────
# Estilos
# ─────────────────────────────────────────────────────────────────
PRIMARY = colors.HexColor("#1a3a5c")
GRAY_DARK = colors.HexColor("#444444")
GRAY = colors.HexColor("#666666")
GRAY_LIGHT = colors.HexColor("#f3f4f6")
RED = colors.HexColor("#dc2626")
ORANGE = colors.HexColor("#f59e0b")
GREEN = colors.HexColor("#16a34a")

SEVERITY_COLOR = {"alta": RED, "media": ORANGE, "baja": GREEN}


def build_styles() -> dict:
    base = getSampleStyleSheet()
    styles = {
        "h1": ParagraphStyle("h1", parent=base["Heading1"], fontSize=22, leading=26,
                              textColor=PRIMARY, spaceBefore=12, spaceAfter=8),
        "h2": ParagraphStyle("h2", parent=base["Heading2"], fontSize=14, leading=18,
                              textColor=PRIMARY, spaceBefore=18, spaceAfter=10,
                              borderPadding=4),
        "h3": ParagraphStyle("h3", parent=base["Heading3"], fontSize=11, leading=14,
                              textColor=PRIMARY, spaceBefore=12, spaceAfter=6),
        "body": ParagraphStyle("body", parent=base["BodyText"], fontSize=10.5, leading=14,
                                textColor=GRAY_DARK, alignment=TA_JUSTIFY,
                                spaceBefore=4, spaceAfter=4),
        "bullet": ParagraphStyle("bullet", parent=base["BodyText"], fontSize=10, leading=13,
                                  textColor=GRAY_DARK, alignment=TA_LEFT,
                                  leftIndent=14, bulletIndent=4,
                                  spaceBefore=2, spaceAfter=2),
        "caption": ParagraphStyle("caption", parent=base["BodyText"], fontSize=9, leading=11,
                                   textColor=GRAY, alignment=TA_LEFT),
        "cover_studio": ParagraphStyle("cover_studio", parent=base["Title"], fontSize=18,
                                        leading=22, alignment=TA_CENTER,
                                        textColor=PRIMARY, spaceAfter=4),
        "cover_persona": ParagraphStyle("cover_persona", parent=base["BodyText"], fontSize=11,
                                         leading=14, alignment=TA_CENTER,
                                         textColor=GRAY, spaceAfter=80),
        "cover_title": ParagraphStyle("cover_title", parent=base["Title"], fontSize=26,
                                       leading=32, alignment=TA_CENTER,
                                       textColor=PRIMARY, spaceAfter=40),
        "legal": ParagraphStyle("legal", parent=base["BodyText"], fontSize=9, leading=12,
                                 textColor=GRAY, alignment=TA_JUSTIFY,
                                 leftIndent=12, rightIndent=12, borderPadding=12),
        "risk_name": ParagraphStyle("risk_name", parent=base["BodyText"], fontSize=10.5,
                                     leading=13, fontName="Helvetica-Bold",
                                     textColor=GRAY_DARK),
        "risk_meta": ParagraphStyle("risk_meta", parent=base["BodyText"], fontSize=9,
                                     leading=11, textColor=GRAY, alignment=TA_LEFT),
        "block_title": ParagraphStyle("block_title", parent=base["BodyText"], fontSize=9.5,
                                       leading=12, fontName="Helvetica-Bold",
                                       textColor=GRAY_DARK, spaceBefore=4, spaceAfter=2),
        "small_bullet": ParagraphStyle("small_bullet", parent=base["BodyText"], fontSize=9.5,
                                        leading=12, textColor=GRAY_DARK,
                                        leftIndent=12, bulletIndent=2,
                                        spaceBefore=1, spaceAfter=1),
    }
    return styles


def _bullets(items, style):
    return [Paragraph(f"• {item}", style) for item in items]


def _on_page(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 9)
    canvas.setFillColor(GRAY)
    canvas.drawCentredString(A4[0] / 2.0, 1 * cm, f"{doc.page}")
    canvas.restoreState()


def render_pdf(row: dict, output_path: Path) -> None:
    content = row["content_json"]
    if isinstance(content, str):
        content = json.loads(content)

    studio = row.get("studio") or {}
    if isinstance(studio, str):
        studio = json.loads(studio)
    identity = studio.get("identity") or {}

    document_type = (row.get("document_type") or content.get("document_type") or "EBSS").upper()
    document_type_full = (
        "Estudio Básico de Seguridad y Salud (EBSS)"
        if document_type == "EBSS"
        else "Estudio de Seguridad y Salud (ESS)"
    )

    studio_name = os.getenv("STUDIO_NAME") or identity.get("nombre_estudio") or "Estudio"
    persona = os.getenv("STUDIO_PERSONA") or identity.get("persona_principal") or "Técnico redactor"
    project_name = row.get("project_name") or "Proyecto"
    location = row.get("location") or "Dirección no especificada"
    client_name = row.get("client_name") or "Promotor"
    area_m2 = row.get("property_area_m2") or "-"
    today = dt.date.today().strftime("%d/%m/%Y")

    s = build_styles()

    doc = BaseDocTemplate(
        str(output_path),
        pagesize=A4,
        leftMargin=2 * cm, rightMargin=2 * cm,
        topMargin=2.5 * cm, bottomMargin=2.5 * cm,
        title=f"{document_type} {project_name}",
        author=studio_name,
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin,
                  doc.width, doc.height, id="main")
    doc.addPageTemplates([PageTemplate(id="default", frames=[frame], onPage=_on_page)])

    story = []

    # ─── PORTADA ───
    story.append(Spacer(1, 2 * cm))
    story.append(Paragraph(studio_name, s["cover_studio"]))
    story.append(Paragraph(persona, s["cover_persona"]))
    story.append(Paragraph(document_type_full, s["cover_title"]))

    cover_data = [
        ["Proyecto:", project_name],
        ["Dirección:", location],
        ["Promotor / Cliente:", client_name],
        ["Superficie:", f"{area_m2} m²"],
        ["Técnico redactor:", persona],
        ["Fecha:", today],
    ]
    cover_tbl = Table(cover_data, colWidths=[4.5 * cm, 11 * cm])
    cover_tbl.setStyle(TableStyle([
        ("FONT", (0, 0), (0, -1), "Helvetica-Bold", 10.5),
        ("FONT", (1, 0), (1, -1), "Helvetica", 10.5),
        ("TEXTCOLOR", (0, 0), (0, -1), GRAY_DARK),
        ("TEXTCOLOR", (1, 0), (1, -1), GRAY_DARK),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(cover_tbl)
    story.append(Spacer(1, 2 * cm))

    legal = (
        "Documento redactado conforme al Real Decreto 1627/1997 de 24 de octubre, "
        "por el que se establecen disposiciones mínimas de seguridad y salud en las "
        "obras de construcción. "
    )
    if document_type == "EBSS":
        legal += ("Estudio Básico redactado al no concurrir los supuestos del artículo 4.1 "
                  "que obligarían a Estudio de Seguridad y Salud completo.")
    else:
        legal += ("Estudio de Seguridad y Salud redactado por concurrir al menos uno de "
                  "los supuestos del artículo 4.1.")

    story.append(Paragraph(legal, s["legal"]))
    story.append(PageBreak())

    # ─── 1. MEMORIA ───
    story.append(Paragraph("1. Memoria descriptiva", s["h2"]))
    story.append(Paragraph(content.get("project_summary", ""), s["body"]))

    story.append(Paragraph("1.1 Tipo de obra y emplazamiento", s["h3"]))
    story.append(Paragraph(
        f"Reforma sobre inmueble existente en {location}. Superficie aproximada {area_m2} m².",
        s["body"]))

    story.append(Paragraph(f"1.2 Justificación del tipo de documento ({document_type})", s["h3"]))
    story.append(Paragraph(content.get("document_type_justification", ""), s["body"]))

    story.append(Paragraph("1.3 Normativa aplicable", s["h3"]))
    story.extend(_bullets(content.get("applicable_regulations", []), s["bullet"]))
    story.append(PageBreak())

    # ─── 2. RIESGOS POR FASE ───
    story.append(Paragraph("2. Identificación de riesgos por fase", s["h2"]))

    for i, phase in enumerate(content.get("phases_with_risks", []), start=1):
        phase_block = []
        phase_block.append(Paragraph(f"2.{i} {phase.get('phase_name', 'Fase')}", s["h3"]))
        phase_meta = (
            f"Orden: {phase.get('phase_order', '-')} · "
            f"Trabajadores simultáneos: {phase.get('workers_simultaneous', '-')}"
        )
        phase_block.append(Paragraph(phase_meta, s["caption"]))
        phase_block.append(Spacer(1, 4))

        for risk in phase.get("specific_risks", []):
            severity = (risk.get("severity") or "media").lower()
            sev_color = SEVERITY_COLOR.get(severity, ORANGE)

            risk_rows = []
            header = (
                f"<b>{risk.get('risk', '')}</b>  "
                f"<font size=8 color='#666666'>· Severidad: <b>{severity}</b> "
                f"· Probabilidad: <b>{risk.get('probability', '-')}</b></font>"
            )
            risk_rows.append([Paragraph(header, s["risk_name"])])

            if risk.get("code_references"):
                refs = " · ".join(risk["code_references"])
                risk_rows.append([Paragraph(
                    f"<font size=9 color='#555555'><b>Normativa:</b> {refs}</font>",
                    s["risk_meta"])])

            if risk.get("preventive_measures"):
                risk_rows.append([Paragraph("Medidas preventivas:", s["block_title"])])
                for m in risk["preventive_measures"]:
                    risk_rows.append([Paragraph(f"• {m}", s["small_bullet"])])

            if risk.get("collective_protections"):
                risk_rows.append([Paragraph("Protecciones colectivas:", s["block_title"])])
                for p in risk["collective_protections"]:
                    risk_rows.append([Paragraph(f"• {p}", s["small_bullet"])])

            if risk.get("epis_required"):
                risk_rows.append([Paragraph("EPIs requeridos:", s["block_title"])])
                for e in risk["epis_required"]:
                    risk_rows.append([Paragraph(f"• {e}", s["small_bullet"])])

            risk_tbl = Table(risk_rows, colWidths=[doc.width - 0.5 * cm])
            risk_tbl.setStyle(TableStyle([
                ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#dddddd")),
                ("LINEBEFORE", (0, 0), (0, -1), 3, sev_color),
                ("BACKGROUND", (0, 0), (0, 0), colors.HexColor("#fafafa")),
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]))
            phase_block.append(risk_tbl)
            phase_block.append(Spacer(1, 6))

        # Mantener cada fase junta si cabe
        story.append(KeepTogether(phase_block))
        story.append(Spacer(1, 8))

    story.append(PageBreak())

    # ─── 3-10. SECCIONES SIMPLES ───
    simple_sections = [
        ("3. Protecciones colectivas generales", content.get("general_collective_protections", []), True),
        ("4. EPIs generales obligatorios", content.get("general_epis", []), True),
    ]
    for title, items, is_list in simple_sections:
        story.append(Paragraph(title, s["h2"]))
        if items:
            story.extend(_bullets(items, s["bullet"]))
        else:
            story.append(Paragraph("(no especificado)", s["caption"]))

    # 5. Protocolo de emergencia
    ep = content.get("emergency_protocol") or {}
    story.append(Paragraph("5. Protocolo de emergencia", s["h2"]))
    story.append(Paragraph("<b>Teléfono emergencias:</b> 112", s["body"]))
    story.append(Paragraph(
        f"<b>Centro de salud más cercano:</b> {ep.get('medical_center', 'A determinar in situ')}",
        s["body"]))
    story.append(Paragraph("<b>Botiquín obligatorio</b> en obra (RD 486/1997 Anexo VI).", s["body"]))
    story.append(Paragraph(
        f"<b>Procedimiento accidente:</b> {ep.get('procedure', 'Asistencia inmediata + parte mutua + comunicación CSS')}",
        s["body"]))

    # 6-10
    other_sections = [
        ("6. Instalaciones de higiene y bienestar",
         content.get("hygiene_facilities") or
         ["Aseos y vestuarios disponibles en la propia vivienda durante la obra."]),
        ("7. Concurrencia de actividades (art. 24 LPRL + RD 171/2004)",
         content.get("simultaneous_activities", []) +
         ["El Coordinador de Seguridad y Salud (CSS) coordinará las actividades concurrentes."]),
        ("8. Formación e información", content.get("training_required", [])),
    ]
    for title, items in other_sections:
        story.append(Paragraph(title, s["h2"]))
        if items:
            story.extend(_bullets(items, s["bullet"]))
        else:
            story.append(Paragraph("(no especificado)", s["caption"]))

    # 9. Vigilancia salud
    story.append(Paragraph("9. Vigilancia de la salud", s["h2"]))
    story.append(Paragraph(
        content.get("medical_surveillance") or "Reconocimiento previo + periódicos según riesgos.",
        s["body"]))

    # 10. Recomendaciones
    story.append(Paragraph("10. Recomendaciones al arquitecto / promotor", s["h2"]))
    story.extend(_bullets(content.get("recommendations_to_architect", []), s["bullet"]))

    story.append(PageBreak())

    # ─── 11. FIRMAS ───
    story.append(Paragraph("11. Firma", s["h2"]))
    story.append(Spacer(1, 1 * cm))

    sig_data = [
        [Paragraph("<b>Técnico redactor del " + document_type + "</b>", s["risk_name"]),
         Paragraph("<b>Conformidad del promotor</b>", s["risk_name"])],
        [Spacer(1, 2 * cm), Spacer(1, 2 * cm)],
        [Paragraph("___________________________", s["body"]),
         Paragraph("___________________________", s["body"])],
        [Paragraph(persona, s["body"]),
         Paragraph(client_name, s["body"])],
        [Paragraph(f"<font size=9 color='#666666'>{studio_name} · {today}</font>", s["caption"]),
         Paragraph("<font size=9 color='#666666'>Fecha: ____ / ____ / ________</font>", s["caption"])],
    ]
    sig_tbl = Table(sig_data, colWidths=[(doc.width - 1 * cm) / 2, (doc.width - 1 * cm) / 2])
    sig_tbl.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(sig_tbl)

    doc.build(story)


def fetch_safety_plan(plan_id, project_id):
    try:
        import psycopg2
        from psycopg2.extras import RealDictCursor
        from dotenv import load_dotenv
    except ImportError:
        print("ERROR: para usar contra Supabase instala: pip install psycopg2-binary python-dotenv",
              file=sys.stderr)
        sys.exit(1)

    load_dotenv()
    conn = psycopg2.connect(
        host=os.environ["SUPABASE_DB_HOST"],
        port=os.getenv("SUPABASE_DB_PORT", "5432"),
        dbname=os.environ["SUPABASE_DB_NAME"],
        user=os.environ["SUPABASE_DB_USER"],
        password=os.environ["SUPABASE_DB_PASSWORD"],
    )
    where = "sp.id = %s::uuid" if plan_id else "sp.project_id = %s::uuid"
    target_id = plan_id or project_id

    sql = f"""
        SELECT
          sp.id            AS plan_id,
          sp.document_type,
          sp.content_json,
          sp.status,
          sp.created_at,
          p.id             AS project_id,
          p.name           AS project_name,
          p.property_area_m2,
          concat_ws(', ', p.location_address, p.location_city, p.location_province) AS location,
          c.name           AS client_name,
          (SELECT row_to_json(g) FROM get_active_studio_profile() g) AS studio
        FROM safety_plans sp
        JOIN projects p ON p.id = sp.project_id
        LEFT JOIN clients c ON c.id = p.client_id
        WHERE {where}
        ORDER BY sp.created_at DESC
        LIMIT 1;
    """
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql, (target_id,))
            row = cur.fetchone()
    finally:
        conn.close()
    if not row:
        raise SystemExit(f"No se encontró safety_plan para {target_id}")
    return dict(row)


DEMO_ROW = {
    "plan_id": "demo-plan-id",
    "document_type": "EBSS",
    "project_name": "Reforma integral piso Embajadores (DEMO)",
    "property_area_m2": 72,
    "location": "Calle Sombrereria 14, 4A, Madrid, Madrid",
    "client_name": "Maria Garcia Lopez",
    "studio": {
        "identity": {
            "nombre_estudio": "Demo ArquitAI",
            "persona_principal": "Equipo ArquitAI",
        }
    },
    "content_json": {
        "document_type": "EBSS",
        "document_type_justification": (
            "Presupuesto de ejecución material estimado < 450.000 €, duración < 30 días laborables, "
            "menos de 20 trabajadores simultáneos. No concurren los supuestos del artículo 4.1 "
            "del RD 1627/1997 que obligarían a redactar Estudio de Seguridad y Salud completo."
        ),
        "project_summary": (
            "Reforma integral de vivienda de 72 m² en planta 4 con ascensor. Apertura cocina-salón "
            "(muro no portante), conversión bañera-ducha, renovación pavimentos y pintura en 2 dormitorios. "
            "Cambio de instalación de calefacción a suelo radiante. No hay afectación estructural mayor."
        ),
        "applicable_regulations": [
            "RD 1627/1997 (Seguridad y salud en obras de construcción)",
            "Ley 31/1995 (Prevención de Riesgos Laborales)",
            "RD 171/2004 (Coordinación actividades empresariales)",
            "RD 486/1997 (Lugares de trabajo)",
            "RD 773/1997 (Equipos de protección individual)",
            "REBT (RD 842/2002)",
            "RITE (RD 1027/2007)",
        ],
        "phases_with_risks": [
            {
                "phase_name": "Demolición parcial (tabique cocina-salón)",
                "phase_order": 1,
                "workers_simultaneous": 2,
                "specific_risks": [
                    {
                        "risk": "Caída a distinto nivel",
                        "severity": "alta",
                        "probability": "baja",
                        "code_references": ["RD 1627/1997 Anexo IV.A", "UNE-EN 363", "UNE-EN 397"],
                        "preventive_measures": [
                            "Acordonado de zona de demolición",
                            "Verificación previa estado del forjado",
                            "Demolición progresiva sin sobrecargar zonas perimetrales",
                        ],
                        "collective_protections": ["Barandillas perimetrales en huecos > 2m"],
                        "epis_required": ["Casco UNE-EN 397", "Calzado S3", "Gafas UNE-EN 166", "Guantes anticorte"],
                    },
                    {
                        "risk": "Inhalación de polvo (sílice / posible amianto si edificio pre-2002)",
                        "severity": "alta",
                        "probability": "media",
                        "code_references": ["RD 396/2006 (amianto)", "RD 374/2001 (agentes químicos)"],
                        "preventive_measures": [
                            "Inspección previa del inmueble por riesgo amianto",
                            "Si sospecha de amianto: DETENER y contratar empresa RERA autorizada",
                            "Humedecer escombros para reducir polvo",
                            "Sellado de zona y ventilación forzada al exterior",
                        ],
                        "collective_protections": ["Plásticos de sellado en accesos a zona en obra"],
                        "epis_required": ["Mascarilla FFP3", "Gafas estancas", "Mono desechable categoría III"],
                    },
                ],
            },
            {
                "phase_name": "Instalación eléctrica (REBT)",
                "phase_order": 2,
                "workers_simultaneous": 1,
                "specific_risks": [
                    {
                        "risk": "Contactos eléctricos directos / indirectos",
                        "severity": "alta",
                        "probability": "media",
                        "code_references": ["REBT (RD 842/2002)", "ITC-BT-24"],
                        "preventive_measures": [
                            "Desconectar y bloquear cuadro general antes de manipular",
                            "Comprobar ausencia de tensión con polímetro antes de tocar",
                            "Solo personal cualificado IBTE para instalaciones",
                            "Boletín certificado por instalador autorizado al finalizar",
                        ],
                        "collective_protections": ["Señalización de cuadro en mantenimiento"],
                        "epis_required": ["Guantes dieléctricos BT", "Calzado dieléctrico", "Casco dieléctrico"],
                    },
                ],
            },
            {
                "phase_name": "Solado y alicatado",
                "phase_order": 3,
                "workers_simultaneous": 2,
                "specific_risks": [
                    {
                        "risk": "Cortes con radial / inhalación polvo cerámica",
                        "severity": "media",
                        "probability": "alta",
                        "code_references": ["RD 1311/2005 (vibraciones)", "RD 286/2006 (ruido)"],
                        "preventive_measures": [
                            "Corte de piezas en zona ventilada o con aspiración",
                            "Uso de radial con disco diamante refrigerado por agua",
                            "Pausas activas para reducir exposición a vibraciones",
                        ],
                        "collective_protections": ["Aspiración localizada en zona de corte"],
                        "epis_required": ["Mascarilla FFP1", "Gafas integrales", "Protector facial radial", "Rodilleras"],
                    },
                ],
            },
        ],
        "general_collective_protections": [
            "Señalización de obra en acceso vivienda y portal",
            "Plásticos protectores en pavimentos no afectados",
            "Iluminación provisional mínima 200 lux en zonas de trabajo",
            "Botiquín de primeros auxilios visible y señalizado",
        ],
        "general_epis": [
            "Casco UNE-EN 397 (obligatorio en todas las fases)",
            "Calzado de seguridad S3",
            "Ropa de trabajo de alta visibilidad",
            "Gafas de protección UNE-EN 166",
            "Guantes (anticorte, dieléctricos o químicos según fase)",
        ],
        "emergency_protocol": {
            "medical_center": "Centro de Salud Embajadores - C/ Mesón de Paredes 39 - 91 528 88 81",
            "procedure": (
                "1) Asistencia inmediata al accidentado. 2) Llamada al 112 si gravedad. "
                "3) Parte a mutua patronal. 4) Comunicación al Coordinador de Seguridad y Salud "
                "para investigación + acciones correctoras. 5) Notificación al promotor."
            ),
        },
        "hygiene_facilities": [
            "Aseos disponibles en la propia vivienda durante la obra (vivienda vacía)",
            "Vestuario improvisado en habitación no afectada",
            "Agua potable en cocina (preservar suministro durante obra)",
        ],
        "simultaneous_activities": [
            "Electricidad y fontanería simultáneas: coordinar para no inutilizar circuitos en uso",
            "Solado y carpintería: proteger pavimentos terminados con plásticos",
            "Pintura: última fase, requiere terminación del resto de gremios",
        ],
        "training_required": [
            "Charla de acogida al iniciar obra (10 min) firmada por todos los trabajadores",
            "Formación específica electricistas: IBTE actualizada",
            "Formación en trabajos en altura (>2m): superada en empresa contratista",
        ],
        "medical_surveillance": (
            "Reconocimiento médico previo según riesgo (electricista alta tensión, expuestos polvo). "
            "Reconocimientos periódicos en mutua patronal de cada empresa contratista. "
            "Vigilancia específica si exposición a amianto (RD 396/2006)."
        ),
        "recommendations_to_architect": [
            "Verificar antes del inicio de obra que todas las empresas contratistas tienen RC profesional vigente y al día con SS",
            "Designar Coordinador de Seguridad y Salud (CSS) por escrito antes del inicio. Habitualmente lo asume el arquitecto técnico DEO.",
            "Si la inspección previa detecta posibilidad de amianto en bajantes o cubierta, DETENER la obra y contratar empresa RERA autorizada antes de continuar.",
            "Comunicar a la comunidad de propietarios fechas de obra y horarios permitidos para evitar conflictos.",
            "Solicitar a cada gremio el Plan de Seguridad y Salud específico de sus tareas, basado en este EBSS.",
        ],
    },
}


def main() -> None:
    parser = argparse.ArgumentParser(description="Genera PDF firmable de un safety_plan")
    g = parser.add_mutually_exclusive_group(required=True)
    g.add_argument("--plan-id", help="UUID de la fila safety_plans")
    g.add_argument("--project-id", help="UUID del proyecto (toma el último plan)")
    g.add_argument("--demo", action="store_true", help="Modo demo: usa datos dummy embebidos (no toca Supabase)")
    parser.add_argument("--output", help="Ruta del PDF de salida")
    args = parser.parse_args()

    row = DEMO_ROW if args.demo else fetch_safety_plan(args.plan_id, args.project_id)

    if args.output:
        out = Path(args.output)
    else:
        out_dir = Path("output")
        out_dir.mkdir(exist_ok=True)
        slug = (row.get("project_name") or "proyecto").replace(" ", "_").replace("(", "").replace(")", "")[:40]
        date = dt.date.today().isoformat()
        out = out_dir / f"{row.get('document_type','EBSS').upper()}_{slug}_{date}.pdf"

    render_pdf(row, out)
    print(f"PDF generado: {out.resolve()}")


if __name__ == "__main__":
    main()
