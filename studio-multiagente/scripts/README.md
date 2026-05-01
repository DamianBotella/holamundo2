# scripts/ — utilidades fuera de n8n

Scripts Python que se ejecutan localmente o en CI, complementando los workflows
n8n. Útiles cuando lo deseado no es trivial o no es posible en n8n
(generación de PDFs nativos, procesamiento batch, exports).

## Catálogo

| Script | Propósito | Cuándo usar |
|---|---|---|
| `check_migration_drift.py` | Detecta migrations en repo no aplicadas en BD (o viceversa). | Inicio de cada sesión de trabajo. |
| `safety_plan_to_pdf.py` | Genera EBSS/PSS PDF desde una fila de `safety_plans`. | Cuando un proyecto necesita el plan de seguridad firmable. |
| `snapshot_workflows.py` | Exporta workflows de producción n8n al repo (anti-drift PA-6). | Semanal vía cron o manual. **Requiere `pip install requests`.** |
| `apply_x3_migrations.py` | Aplica migrations multi-tenant + RLS con verificación guiada. | Sesión X3 cuando todo lo demás esté listo. **Requiere `pip install psycopg[binary]`.** |

## Workflow típico de sesión

```bash
# 1. Verificar drift cero al empezar
python scripts/check_migration_drift.py --check

# 2. Hacer el trabajo de la sesión...

# 3. Si se modificaron workflows en producción, snapshear
python scripts/snapshot_workflows.py --critical

# 4. Si se aplicó migration nueva, registrarla en applied_migrations
#    (o usar apply_x3_migrations.py para flujos guiados).

# 5. Cerrar sesión con drift cero confirmado
python scripts/check_migration_drift.py --check
```

## Cron sugerido (post-X4)

```cron
# Snapshot semanal de workflows críticos
0 3 * * 1 cd /path/to/repo && python studio-multiagente/scripts/snapshot_workflows.py --critical >> /var/log/arquitai-snapshot.log 2>&1

# Drift check diario
0 6 * * * cd /path/to/repo && python studio-multiagente/scripts/check_migration_drift.py --check
```

---

## Detalles por script

### `safety_plan_to_pdf.py`

Genera un **PDF firmable** profesional de un EBSS/ESS a partir de una fila de
la tabla `safety_plans` en Supabase. Usa `reportlab` (Python puro, sin libs
nativas).

**Origen**: B26, criterio del agente Document Generator de
`agency-agents-main`. Reescrito en B26 P4 con `reportlab` tras incidentes
con `weasyprint`+Docker en Windows. Reemplaza el paso humano "JSON → Google
Doc → exportar PDF → firmar" por un solo comando.

---

## Probarlo en 2 minutos (modo demo, sin Supabase)

El script tiene un modo `--demo` que usa **datos dummy embebidos** y genera
un PDF de muestra. **No necesitas Supabase ni credenciales** — solo Python y
reportlab.

```bash
# 1. Asegúrate de tener Python 3.9+
python --version

# 2. Instala reportlab (es Python puro, sin libs nativas)
pip install reportlab

# 3. Navega al directorio del script
cd studio-multiagente/scripts

# 4. Ejecuta en modo demo
python safety_plan_to_pdf.py --demo
```

Verás:

```
PDF generado: c:\...\studio-multiagente\scripts\output\EBSS_Reforma_integral_piso_..._2026-04-29.pdf
```

Abre ese PDF con Edge / Acrobat / cualquier visor.

### Qué debes ver en el PDF demo

- Portada con "Demo ArquitAI" + "Equipo ArquitAI" + datos del proyecto demo
  (reforma piso 72 m² Madrid).
- 11 secciones numeradas con riesgos por fase coloreados por severidad
  (rojo / naranja / verde según `severity`).
- Cada riesgo con normativa, EPIs, medidas preventivas y protecciones
  colectivas en bloques diferenciados.
- Bloque de firmas final con líneas separadas para técnico redactor + promotor.

Si el PDF se ve correcto, **el script está listo** para usar contra Supabase
real.

---

## Uso real (contra Supabase)

Cuando exista una fila en `safety_plans` y quieras generar el PDF firmable
desde ella:

```bash
# Por safety_plan_id directo
python safety_plan_to_pdf.py --plan-id 8a3f2b1c-...

# Por project_id (toma el último plan del proyecto)
python safety_plan_to_pdf.py --project-id 5c230fc9-...

# Output a fichero concreto
python safety_plan_to_pdf.py --plan-id 8a3f2b1c-... --output mi_ebss.pdf
```

**Dependencias adicionales** (solo si NO usas `--demo`):

```bash
pip install psycopg2-binary python-dotenv
```

**Variables de entorno** (`.env` en la raíz del repo, o exportadas):

```bash
SUPABASE_DB_HOST=db.xxx.supabase.co
SUPABASE_DB_PORT=5432
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USER=postgres.xxx
SUPABASE_DB_PASSWORD=xxx

# Opcionales (override del studio_profile activo):
STUDIO_NAME="Demo ArquitAI"
STUDIO_PERSONA="Equipo ArquitAI"
```

---

## Estructura del PDF generado

10 secciones de contenido + portada + bloque de firmas:

1. Memoria descriptiva (tipo obra + emplazamiento + justificación EBSS/ESS)
2. Identificación de riesgos por fase (con severidad, EPIs, normativa)
3. Protecciones colectivas generales
4. EPIs generales obligatorios
5. Protocolo de emergencia (112, centro salud, botiquín, procedimiento)
6. Instalaciones de higiene
7. Concurrencia de actividades (art. 24 LPRL + RD 171/2004)
8. Formación
9. Vigilancia de salud
10. Recomendaciones al arquitecto/promotor
11. Bloque de firmas (técnico redactor + promotor)

Para modificar diseño/branding, editar `build_styles()` y la función
`render_pdf()` en el propio script.

---

## Integración futura con n8n

- **Opción A**: workflow llama por HTTP a un microservicio que ejecuta este
  script y devuelve el PDF binario.
- **Opción B**: cron en host que detecta `safety_plans.status='approved'` y
  ejecuta el script + sube el PDF a Drive vinculado al proyecto.

Por ahora se ejecuta manualmente. Cualquiera de las dos integraciones es
trivial cuando el flujo end-to-end esté validado.
