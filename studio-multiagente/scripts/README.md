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

## Probarlo en 5 minutos (modo demo, sin Supabase)

El script tiene un modo `--demo` que usa **datos dummy embebidos** y genera un
PDF de muestra. **No necesitas Supabase ni credenciales** — solo Python y
weasyprint. Es la forma rapida de ver que funciona y validar el diseno del
PDF antes de invertir mas.

### Camino A — Docker (recomendado en Windows)

Es el camino con menos friccion porque weasyprint en Windows requiere
librerias C nativas (Pango, Cairo) que son un dolor de instalar.

```bash
# Desde la raiz del repo
cd studio-multiagente/scripts

# Ejecutar modo demo (genera output/EBSS_demo_*.pdf)
docker run --rm -v "${PWD}:/work" -w /work python:3.12-slim bash -c "\
  apt-get update -qq && apt-get install -y -qq \
    libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz0b libgdk-pixbuf-2.0-0 \
    libcairo2 libffi-dev shared-mime-info && \
  pip install -q weasyprint jinja2 python-dotenv && \
  python safety_plan_to_pdf.py --demo"
```

Tras ejecutar, abre `studio-multiagente/scripts/output/EBSS_*.pdf` con tu
visor PDF favorito.

### Camino B — WSL2 (Linux dentro de Windows)

Si tienes WSL2 instalado:

```bash
# Dentro de tu WSL Ubuntu/Debian
sudo apt update
sudo apt install -y python3 python3-pip libpango-1.0-0 libpangoft2-1.0-0 \
  libharfbuzz0b libgdk-pixbuf-2.0-0 libcairo2 libffi-dev shared-mime-info

cd /mnt/c/Users/Damian\ Martinez/Desktop/holamundo2/studio-multiagente/scripts
pip install weasyprint jinja2 python-dotenv
python3 safety_plan_to_pdf.py --demo
```

### Camino C — Python nativo Windows con GTK

Mas friccion pero funciona:

1. Instalar **GTK3 runtime para Windows**:
   https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer/releases
   (descarga `gtk3-runtime-*-installer.exe`, instalar)
2. Asegurarse que `C:\Program Files\GTK3-Runtime Win64\bin` esta en el PATH.
3. Reiniciar terminal.
4. `pip install weasyprint jinja2 python-dotenv`
5. `python safety_plan_to_pdf.py --demo`

Si falla con `OSError: cannot load library 'libgobject-2.0-0'`, falta GTK
en el PATH. Volver al paso 2.

### Que debes ver en el PDF demo

- Portada con "Demo ArquitAI" + "Equipo ArquitAI" + datos del proyecto demo.
- 11 secciones numeradas con riesgos por fase coloreados por severidad
  (rojo/naranja/verde).
- Bloque de firmas final con linea para tecnico redactor + promotor.

Si el PDF se ve correcto, **el script esta listo** para usar contra Supabase
real.

---

## Uso real (contra Supabase, requiere fila en safety_plans)

```bash
# Por safety_plan_id directo
python safety_plan_to_pdf.py --plan-id 8a3f2b1c-...

# Por project_id (toma el ultimo plan del proyecto)
python safety_plan_to_pdf.py --project-id 5c230fc9-...

# Output a fichero concreto
python safety_plan_to_pdf.py --plan-id 8a3f2b1c-... --output mi_ebss.pdf
```

**Dependencias del sistema**: ver caminos A/B/C arriba para weasyprint.

**Dependencias Python**:

```bash
pip install weasyprint psycopg2-binary jinja2 python-dotenv
```

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
