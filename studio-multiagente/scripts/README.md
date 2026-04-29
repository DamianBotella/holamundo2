# scripts/ — utilidades fuera de n8n

Scripts Python que se ejecutan localmente o en CI, complementando los workflows
n8n. Útiles cuando lo deseado no es trivial o no es posible en n8n
(generación de PDFs nativos, procesamiento batch, exports).

## Contenido

### `safety_plan_to_pdf.py`

Genera un **PDF firmable** profesional de un EBSS/ESS a partir de una fila de
la tabla `safety_plans` en Supabase. Usa `weasyprint` (HTML+CSS → PDF).

**Origen**: B26, criterio del agente Document Generator de
`agency-agents-main`. Reemplaza el paso humano "JSON → Google Doc → exportar
PDF → firmar" por un solo comando.

**Uso**:

```bash
# Por safety_plan_id directo
python safety_plan_to_pdf.py --plan-id 8a3f2b1c-...

# Por project_id (toma el ultimo plan del proyecto)
python safety_plan_to_pdf.py --project-id 5c230fc9-...

# Output a fichero concreto
python safety_plan_to_pdf.py --plan-id 8a3f2b1c-... --output mi_ebss.pdf
```

**Dependencias**:

```bash
pip install weasyprint psycopg2-binary jinja2 python-dotenv
```

`weasyprint` requiere paquetes del sistema (Pango, Cairo). En Windows puede ser
no trivial; alternativa: ejecutar dentro de WSL o Docker.

**Variables de entorno** (en `.env` del repo o exportadas):

```bash
SUPABASE_DB_HOST=db.xxx.supabase.co
SUPABASE_DB_PORT=5432
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USER=postgres.xxx
SUPABASE_DB_PASSWORD=xxx
# Opcionales (override del studio_profile):
STUDIO_NAME="Demo ArquitAI"
STUDIO_PERSONA="Equipo ArquitAI"
```

**Output**: `./output/EBSS_<project>_<date>.pdf` por defecto.

**Estructura del PDF generado** (10 secciones + portada + firma):

1. Memoria descriptiva (tipo obra + emplazamiento + justificacion EBSS/ESS)
2. Identificacion de riesgos por fase (con severidad, EPIs, normativa)
3. Protecciones colectivas generales
4. EPIs generales obligatorios
5. Protocolo de emergencia (112, centro salud, botiquin, procedimiento accidente)
6. Instalaciones de higiene
7. Concurrencia de actividades (art. 24 LPRL + RD 171/2004)
8. Formacion
9. Vigilancia de salud
10. Recomendaciones al arquitecto/promotor
11. Bloque de firmas (tecnico redactor + promotor)

**Plantilla**: HTML+CSS embebidos en el script (`HTML_TEMPLATE` y `CSS_STYLE`).
Para modificar diseño/branding, editar esas constantes directamente.

**Integracion futura con n8n**:
- Opcion A: workflow llama por HTTP a un microservicio que ejecuta este
  script y devuelve el PDF binario.
- Opcion B: cron en host que detecta `safety_plans.status='approved'` y
  ejecuta el script + sube el PDF a Drive vinculado al proyecto.

Por ahora se ejecuta manualmente. Cualquiera de las dos integraciones es
trivial cuando MCP n8n vuelva.
