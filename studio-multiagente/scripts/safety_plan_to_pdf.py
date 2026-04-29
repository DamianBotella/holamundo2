#!/usr/bin/env python3
"""
safety_plan_to_pdf.py — Convierte una fila de safety_plans (Supabase) en PDF firmable.

Generado en B26 con criterio del agente Document Generator de agency-agents-main.
Reemplaza el paso humano "JSON → Google Doc → exportar PDF → firmar" por un solo comando.

Uso:
    # Por safety_plan_id directo
    python safety_plan_to_pdf.py --plan-id 8a3f2b1c-...

    # Por project_id (toma el ultimo plan del proyecto)
    python safety_plan_to_pdf.py --project-id 5c230fc9-...

    # Output a fichero concreto (default: ./output/EBSS_<project>_<date>.pdf)
    python safety_plan_to_pdf.py --plan-id 8a3f2b1c-... --output mi_ebss.pdf

Dependencias:
    pip install weasyprint psycopg2-binary jinja2 python-dotenv

Variables de entorno (en .env):
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
    import psycopg2
    from psycopg2.extras import RealDictCursor
    from jinja2 import Template
    from weasyprint import HTML, CSS
    from dotenv import load_dotenv
except ImportError as e:
    print(f"ERROR: falta dependencia: {e}", file=sys.stderr)
    print("Instalar con: pip install weasyprint psycopg2-binary jinja2 python-dotenv", file=sys.stderr)
    sys.exit(1)


# ─────────────────────────────────────────────────────────────────
# Plantilla HTML del EBSS / PSS
# ─────────────────────────────────────────────────────────────────
HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>{{ document_type }} - {{ project.name }}</title>
</head>
<body>

<div class="cover">
  <div class="cover-header">
    <div class="studio-name">{{ studio.nombre_estudio }}</div>
    <div class="studio-persona">{{ studio.persona_principal }}</div>
  </div>

  <h1 class="doc-title">{{ document_type_full }}</h1>

  <div class="cover-info">
    <div><span class="label">Proyecto:</span> {{ project.name }}</div>
    <div><span class="label">Direccion:</span> {{ project.location }}</div>
    <div><span class="label">Promotor / Cliente:</span> {{ project.client_name }}</div>
    <div><span class="label">Tecnico redactor:</span> {{ studio.persona_principal }}</div>
    <div><span class="label">Fecha:</span> {{ today }}</div>
  </div>

  <p class="legal-notice">
    Documento redactado conforme al Real Decreto 1627/1997 de 24 de octubre,
    por el que se establecen disposiciones minimas de seguridad y salud en las
    obras de construccion. {% if document_type == 'EBSS' %}Estudio Basico
    redactado al no concurrir los supuestos del articulo 4.1 que obligarian a
    Estudio de Seguridad y Salud completo.{% else %}Estudio de Seguridad y
    Salud redactado por concurrir al menos uno de los supuestos del articulo
    4.1.{% endif %}
  </p>
</div>

<div class="page-break"></div>

<h2>1. Memoria descriptiva</h2>
<p>{{ project_summary }}</p>

<h3>1.1 Tipo de obra y emplazamiento</h3>
<p>Reforma sobre inmueble existente en {{ project.location }}. Superficie aproximada {{ project.area_m2 }} m2.</p>

<h3>1.2 Justificacion del tipo de documento ({{ document_type }})</h3>
<p>{{ document_type_justification }}</p>

<h3>1.3 Normativa aplicable</h3>
<ul>
{% for r in applicable_regulations %}
  <li>{{ r }}</li>
{% endfor %}
</ul>

<div class="page-break"></div>

<h2>2. Identificacion de riesgos por fase</h2>
{% for phase in phases_with_risks %}
<div class="phase">
  <h3>2.{{ loop.index }} {{ phase.phase_name }}</h3>
  <div class="phase-meta">
    <span>Orden de ejecucion: {{ phase.phase_order }}</span>
    <span>Trabajadores simultaneos: {{ phase.workers_simultaneous or '-' }}</span>
  </div>

  {% for risk in phase.specific_risks %}
  <div class="risk severity-{{ risk.severity }}">
    <div class="risk-header">
      <span class="risk-name">{{ risk.risk }}</span>
      <span class="risk-tags">
        Severidad: <b>{{ risk.severity }}</b> ·
        Probabilidad: <b>{{ risk.probability }}</b>
      </span>
    </div>

    {% if risk.code_references %}
    <div class="risk-codes">
      <span class="label">Normativa:</span>
      {{ risk.code_references | join(' · ') }}
    </div>
    {% endif %}

    <div class="risk-block">
      <div class="block-title">Medidas preventivas</div>
      <ul>{% for m in risk.preventive_measures %}<li>{{ m }}</li>{% endfor %}</ul>
    </div>

    {% if risk.collective_protections %}
    <div class="risk-block">
      <div class="block-title">Protecciones colectivas</div>
      <ul>{% for p in risk.collective_protections %}<li>{{ p }}</li>{% endfor %}</ul>
    </div>
    {% endif %}

    {% if risk.epis_required %}
    <div class="risk-block">
      <div class="block-title">EPIs requeridos</div>
      <ul>{% for e in risk.epis_required %}<li>{{ e }}</li>{% endfor %}</ul>
    </div>
    {% endif %}
  </div>
  {% endfor %}
</div>
{% endfor %}

<div class="page-break"></div>

<h2>3. Protecciones colectivas generales</h2>
<ul>{% for p in general_collective_protections %}<li>{{ p }}</li>{% endfor %}</ul>

<h2>4. EPIs generales obligatorios</h2>
<ul>{% for e in general_epis %}<li>{{ e }}</li>{% endfor %}</ul>

<h2>5. Protocolo de emergencia</h2>
{% if emergency_protocol %}
<p><b>Telefono emergencias:</b> 112</p>
<p><b>Centro de salud mas cercano:</b> {{ emergency_protocol.medical_center or 'A determinar in situ' }}</p>
<p><b>Botiquin obligatorio</b> en obra (RD 486/1997 Anexo VI).</p>
<p><b>Procedimiento accidente:</b> {{ emergency_protocol.procedure or 'Asistencia inmediata + parte mutua + comunicacion CSS' }}</p>
{% endif %}

<h2>6. Instalaciones de higiene y bienestar</h2>
{% if hygiene_facilities %}
<ul>{% for h in hygiene_facilities %}<li>{{ h }}</li>{% endfor %}</ul>
{% else %}
<p>Aseos y vestuarios disponibles en la propia vivienda durante la obra (reforma habitada / vacia).</p>
{% endif %}

<h2>7. Concurrencia de actividades (art. 24 LPRL + RD 171/2004)</h2>
{% if simultaneous_activities %}
<ul>{% for s in simultaneous_activities %}<li>{{ s }}</li>{% endfor %}</ul>
{% endif %}
<p>El Coordinador de Seguridad y Salud (CSS) coordinara las actividades concurrentes.</p>

<h2>8. Formacion e informacion</h2>
<ul>{% for t in training_required %}<li>{{ t }}</li>{% endfor %}</ul>

<h2>9. Vigilancia de la salud</h2>
<p>{{ medical_surveillance }}</p>

<h2>10. Recomendaciones al arquitecto / promotor</h2>
<ul>{% for r in recommendations_to_architect %}<li>{{ r }}</li>{% endfor %}</ul>

<div class="page-break"></div>

<h2>11. Firma</h2>

<div class="signature-blocks">
  <div class="signature-block">
    <div class="signature-role">Tecnico redactor del {{ document_type }}</div>
    <div class="signature-line"></div>
    <div class="signature-name">{{ studio.persona_principal }}</div>
    <div class="signature-meta">{{ studio.nombre_estudio }} · {{ today }}</div>
  </div>

  <div class="signature-block">
    <div class="signature-role">Conformidad del promotor</div>
    <div class="signature-line"></div>
    <div class="signature-name">{{ project.client_name }}</div>
    <div class="signature-meta">Fecha: ____ / ____ / ________</div>
  </div>
</div>

</body>
</html>
"""


CSS_STYLE = """
@page { size: A4; margin: 2.5cm 2cm; @bottom-center { content: counter(page) " / " counter(pages); font-size: 9pt; color: #666; } }
body { font-family: Helvetica, Arial, sans-serif; font-size: 10.5pt; line-height: 1.5; color: #222; }
h1, h2, h3 { color: #1a3a5c; }
h1 { font-size: 22pt; margin: 1em 0 0.3em; }
h2 { font-size: 14pt; border-bottom: 2px solid #1a3a5c; padding-bottom: 4px; margin-top: 1.5em; }
h3 { font-size: 11pt; margin-top: 1em; }
.cover { padding: 2cm 0; text-align: center; }
.cover-header { margin-bottom: 4cm; }
.studio-name { font-size: 18pt; font-weight: bold; color: #1a3a5c; }
.studio-persona { font-size: 11pt; color: #666; margin-top: 4px; }
.doc-title { font-size: 26pt; margin: 2cm 0; color: #1a3a5c; }
.cover-info { text-align: left; margin: 2cm auto; max-width: 14cm; }
.cover-info div { margin: 6px 0; }
.label { font-weight: bold; color: #444; }
.legal-notice { font-size: 9pt; color: #555; margin-top: 3cm; padding: 12px; border-left: 3px solid #1a3a5c; text-align: justify; }
.page-break { page-break-after: always; }
.phase { margin: 1em 0 2em; }
.phase-meta { font-size: 9pt; color: #666; margin-bottom: 8px; }
.phase-meta span { margin-right: 16px; }
.risk { border: 1px solid #ddd; border-radius: 4px; padding: 10px 14px; margin: 8px 0; page-break-inside: avoid; }
.risk.severity-alta { border-left: 4px solid #dc2626; }
.risk.severity-media { border-left: 4px solid #f59e0b; }
.risk.severity-baja { border-left: 4px solid #16a34a; }
.risk-header { display: flex; justify-content: space-between; margin-bottom: 6px; }
.risk-name { font-weight: bold; }
.risk-tags { font-size: 9pt; color: #666; }
.risk-codes { font-size: 9pt; color: #555; margin: 4px 0 8px; padding: 4px 8px; background: #f3f4f6; border-radius: 3px; }
.risk-block { margin-top: 6px; }
.block-title { font-size: 9.5pt; font-weight: bold; color: #444; margin-bottom: 2px; }
.risk-block ul { margin: 0 0 4px 0; padding-left: 22px; font-size: 9.5pt; }
ul { margin: 4px 0; padding-left: 22px; }
li { margin: 2px 0; }
.signature-blocks { display: flex; gap: 2cm; margin-top: 3cm; }
.signature-block { flex: 1; }
.signature-role { font-weight: bold; color: #1a3a5c; margin-bottom: 1.5cm; }
.signature-line { border-top: 1px solid #222; height: 0; margin-bottom: 8px; }
.signature-name { font-size: 10pt; }
.signature-meta { font-size: 9pt; color: #666; margin-top: 4px; }
"""


def fetch_safety_plan(conn, plan_id: str | None, project_id: str | None) -> dict:
    """Lee la fila objetivo de safety_plans + datos relacionados de projects/clients/studio_profile."""
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
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(sql, (target_id,))
        row = cur.fetchone()
    if not row:
        raise SystemExit(f"No se encontro safety_plan para {target_id}")
    return dict(row)


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
        "Estudio Basico de Seguridad y Salud (EBSS)"
        if document_type == "EBSS"
        else "Estudio de Seguridad y Salud (ESS)"
    )

    ctx = {
        "document_type": document_type,
        "document_type_full": document_type_full,
        "document_type_justification": content.get("document_type_justification", ""),
        "project_summary": content.get("project_summary", ""),
        "applicable_regulations": content.get("applicable_regulations", ["RD 1627/1997", "Ley 31/1995"]),
        "phases_with_risks": content.get("phases_with_risks", []),
        "general_collective_protections": content.get("general_collective_protections", []),
        "general_epis": content.get("general_epis", []),
        "emergency_protocol": content.get("emergency_protocol", {}),
        "hygiene_facilities": content.get("hygiene_facilities", []),
        "simultaneous_activities": content.get("simultaneous_activities", []),
        "training_required": content.get("training_required", []),
        "medical_surveillance": content.get("medical_surveillance", "Reconocimiento previo + periodicos segun riesgos."),
        "recommendations_to_architect": content.get("recommendations_to_architect", []),
        "project": {
            "name": row.get("project_name") or "Proyecto",
            "location": row.get("location") or "Direccion no especificada",
            "client_name": row.get("client_name") or "Promotor",
            "area_m2": row.get("property_area_m2") or "-",
        },
        "studio": {
            "nombre_estudio": os.getenv("STUDIO_NAME") or identity.get("nombre_estudio") or "Estudio",
            "persona_principal": os.getenv("STUDIO_PERSONA") or identity.get("persona_principal") or "Tecnico redactor",
        },
        "today": dt.date.today().strftime("%d/%m/%Y"),
    }

    html_str = Template(HTML_TEMPLATE).render(**ctx)
    HTML(string=html_str).write_pdf(str(output_path), stylesheets=[CSS(string=CSS_STYLE)])


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
            "Presupuesto de ejecucion material estimado < 450.000 EUR, duracion < 30 dias laborables, "
            "menos de 20 trabajadores simultaneos. No concurren los supuestos del articulo 4.1 "
            "del RD 1627/1997 que obligarian a redactar Estudio de Seguridad y Salud completo."
        ),
        "project_summary": (
            "Reforma integral de vivienda de 72 m2 en planta 4 con ascensor. Apertura cocina-salon "
            "(muro no portante), conversion banera-ducha, renovacion pavimentos y pintura en 2 dormitorios. "
            "Cambio de instalacion de calefaccion a suelo radiante. No hay afectacion estructural mayor."
        ),
        "applicable_regulations": [
            "RD 1627/1997 (Seguridad y salud en obras de construccion)",
            "Ley 31/1995 (Prevencion de Riesgos Laborales)",
            "RD 171/2004 (Coordinacion actividades empresariales)",
            "RD 486/1997 (Lugares de trabajo)",
            "RD 773/1997 (Equipos de proteccion individual)",
            "REBT (RD 842/2002)",
            "RITE (RD 1027/2007)",
        ],
        "phases_with_risks": [
            {
                "phase_name": "Demolicion parcial (tabique cocina-salon)",
                "phase_order": 1,
                "workers_simultaneous": 2,
                "specific_risks": [
                    {
                        "risk": "Caida a distinto nivel",
                        "severity": "alta",
                        "probability": "baja",
                        "code_references": ["RD 1627/1997 Anexo IV.A", "UNE-EN 363", "UNE-EN 397"],
                        "preventive_measures": [
                            "Acordonado de zona de demolicion",
                            "Verificacion previa estado del forjado",
                            "Demolicion progresiva sin sobrecargar zonas perimetrales",
                        ],
                        "collective_protections": ["Barandillas perimetrales en huecos > 2m"],
                        "epis_required": ["Casco UNE-EN 397", "Calzado S3", "Gafas UNE-EN 166", "Guantes anticorte"],
                    },
                    {
                        "risk": "Inhalacion de polvo (silice / posible amianto si edificio pre-2002)",
                        "severity": "alta",
                        "probability": "media",
                        "code_references": ["RD 396/2006 (amianto)", "RD 374/2001 (agentes quimicos)"],
                        "preventive_measures": [
                            "Inspeccion previa del inmueble por riesgo amianto",
                            "Si sospecha de amianto: DETENER y contratar empresa RERA autorizada",
                            "Humidificar escombros para reducir polvo",
                            "Sellado de zona y ventilacion forzada al exterior",
                        ],
                        "collective_protections": ["Plasticos de sellado en accesos a zona en obra"],
                        "epis_required": ["Mascarilla FFP3", "Gafas estancas", "Mono desechable categoria III"],
                    },
                ],
            },
            {
                "phase_name": "Instalacion electrica (REBT)",
                "phase_order": 2,
                "workers_simultaneous": 1,
                "specific_risks": [
                    {
                        "risk": "Contactos electricos directos / indirectos",
                        "severity": "alta",
                        "probability": "media",
                        "code_references": ["REBT (RD 842/2002)", "ITC-BT-24"],
                        "preventive_measures": [
                            "Desconectar y bloquear cuadro general antes de manipular",
                            "Comprobar ausencia de tension con polimetro antes de tocar",
                            "Solo personal cualificado IBTE para instalaciones",
                            "Boletin certificado por instalador autorizado al finalizar",
                        ],
                        "collective_protections": ["Senalizacion de cuadro en mantenimiento"],
                        "epis_required": ["Guantes dielectricos BT", "Calzado dielectrico", "Casco dielectrico"],
                    },
                ],
            },
            {
                "phase_name": "Solado y alicatado",
                "phase_order": 3,
                "workers_simultaneous": 2,
                "specific_risks": [
                    {
                        "risk": "Cortes con radial / inhalacion polvo ceramica",
                        "severity": "media",
                        "probability": "alta",
                        "code_references": ["RD 1311/2005 (vibraciones)", "RD 286/2006 (ruido)"],
                        "preventive_measures": [
                            "Corte de piezas en zona ventilada o con aspiracion",
                            "Uso de radial con disco diamante refrigerado por agua",
                            "Pausas activas para reducir exposicion a vibraciones",
                        ],
                        "collective_protections": ["Aspiracion localizada en zona de corte"],
                        "epis_required": ["Mascarilla FFP1", "Gafas integrales", "Protector facial radial", "Rodilleras"],
                    },
                ],
            },
        ],
        "general_collective_protections": [
            "Senalizacion de obra en acceso vivienda y portal",
            "Plasticos protectores en pavimentos no afectados",
            "Iluminacion provisional minima 200 lux en zonas de trabajo",
            "Botiquin de primeros auxilios visible y senalizado",
        ],
        "general_epis": [
            "Casco UNE-EN 397 (obligatorio en todas las fases)",
            "Calzado de seguridad S3",
            "Ropa de trabajo de alta visibilidad",
            "Gafas de proteccion UNE-EN 166",
            "Guantes (anticorte, dielectricos o quimicos segun fase)",
        ],
        "emergency_protocol": {
            "medical_center": "Centro de Salud Embajadores - C/ Mesón de Paredes 39 - 91 528 88 81",
            "procedure": (
                "1) Asistencia inmediata al accidentado. 2) Llamada al 112 si gravedad. "
                "3) Parte a mutua patronal. 4) Comunicacion al Coordinador de Seguridad y Salud "
                "para investigacion + acciones correctoras. 5) Notificacion al promotor."
            ),
        },
        "hygiene_facilities": [
            "Aseos disponibles en la propia vivienda durante la obra (vivienda vacia)",
            "Vestuario improvisado en habitacion no afectada",
            "Agua potable en cocina (preservar suministro durante obra)",
        ],
        "simultaneous_activities": [
            "Electricidad y fontaneria simultaneas: coordinar para no inutilizar circuitos en uso",
            "Solado y carpinteria: proteger pavimentos terminados con plasticos",
            "Pintura: ultima fase, requiere terminacion del resto de gremios",
        ],
        "training_required": [
            "Charla de acogida al iniciar obra (10 min) firmada por todos los trabajadores",
            "Formacion especifica electricistas: IBTE actualizada",
            "Formacion en trabajos en altura (>2m): superada en empresa contratista",
        ],
        "medical_surveillance": (
            "Reconocimiento medico previo segun riesgo (electricista alta tension, expuestos polvo). "
            "Reconocimientos periodicos en mutua patronal de cada empresa contratista. "
            "Vigilancia especifica si exposicion a amianto (RD 396/2006)."
        ),
        "recommendations_to_architect": [
            "Verificar antes del inicio de obra que todas las empresas contratistas tienen RC profesional vigente y al dia con SS",
            "Designar Coordinador de Seguridad y Salud (CSS) por escrito antes del inicio. Habitualmente lo asume el arquitecto tecnico DEO.",
            "Si la inspeccion previa detecta posibilidad de amianto en bajantes o cubierta, DETENER la obra y contratar empresa RERA autorizada antes de continuar.",
            "Comunicar a la comunidad de propietarios fechas de obra y horarios permitidos para evitar conflictos.",
            "Solicitar a cada gremio el Plan de Seguridad y Salud especifico de sus tareas, basado en este EBSS.",
        ],
    },
}


def main() -> None:
    parser = argparse.ArgumentParser(description="Genera PDF firmable de un safety_plan")
    g = parser.add_mutually_exclusive_group(required=True)
    g.add_argument("--plan-id", help="UUID de la fila safety_plans")
    g.add_argument("--project-id", help="UUID del proyecto (toma el ultimo plan)")
    g.add_argument("--demo", action="store_true", help="Modo demo: usa datos dummy embebidos (no toca Supabase)")
    parser.add_argument("--output", help="Ruta del PDF de salida")
    args = parser.parse_args()

    load_dotenv()

    if args.demo:
        row = DEMO_ROW
    else:
        conn = psycopg2.connect(
            host=os.environ["SUPABASE_DB_HOST"],
            port=os.getenv("SUPABASE_DB_PORT", "5432"),
            dbname=os.environ["SUPABASE_DB_NAME"],
            user=os.environ["SUPABASE_DB_USER"],
            password=os.environ["SUPABASE_DB_PASSWORD"],
        )
        try:
            row = fetch_safety_plan(conn, args.plan_id, args.project_id)
        finally:
            conn.close()

    if args.output:
        out = Path(args.output)
    else:
        out_dir = Path("output")
        out_dir.mkdir(exist_ok=True)
        slug = (row.get("project_name") or "proyecto").replace(" ", "_")[:40]
        date = dt.date.today().isoformat()
        out = out_dir / f"{row.get('document_type','EBSS').upper()}_{slug}_{date}.pdf"

    render_pdf(row, out)
    print(f"PDF generado: {out.resolve()}")


if __name__ == "__main__":
    main()
