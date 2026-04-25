# `agent_site_monitor` — Seguimiento de obra con Claude Vision

## Estado

- **Migración 011** aplicada: tabla `site_reports` (20 columnas).
- **Workflow** `agent_site_monitor` (`DPy3FBugAbWP10BD`) activo.
- **Verificado E2E** con foto real (Unsplash): Vision devolvió detected_phase, progress_pct, vision_summary y JSON estructurado correctamente.
- **Última revisión**: 2026-04-25.

## Por qué cierra el loop

El sistema construye un plan en `agent_planner` pero no sabía qué pasaba en obra hasta la siguiente visita del arquitecto. `agent_site_monitor` permite que cualquier visita o foto recibida durante la semana se compare automáticamente contra ese plan, detectando incidencias el mismo día.

## Cómo se usa

Desde el navegador o un script: subir la foto a Drive, copiar el enlace público compartible, y POST al webhook:

```bash
curl -X POST https://n8n-n8n.zzeluw.easypanel.host/webhook/site-report \
  -H "Content-Type: application/json" \
  -H "X-API-Key: arquitai-..." \
  -d '{
    "project_id": "<uuid>",
    "photo_url": "https://drive.google.com/uc?id=...",
    "observations": "Visita semanal — vista cocina tras demolición",
    "expected_phase": "demolicion"
  }'
```

Con varias fotos (hasta 6 por reporte):
```json
{ "project_id": "...", "photo_urls": ["url1","url2","url3"], "observations": "..." }
```

Respuesta `200`:
```json
{
  "status": "analyzed",
  "report_id": "uuid",
  "detected_phase": "demolicion",
  "progress_pct": 35,
  "issues_count": 2,
  "deviations_count": 1,
  "flagged": true,
  "vision_summary": "Tabique cocina-salón eliminado parcialmente. Se observan restos de yeso sin retirar; hay material de demolición acumulado bloqueando salida emergencia."
}
```

Si `flagged: true` (alguna severidad `high` o ≥3 issues), Damián recibe un email HTML automático con la lista detallada de incidencias y desviaciones.

## URLs públicas — limitación importante

OpenAI descarga la imagen para analizarla. La URL **debe responder a un User-Agent neutro**:

- ✅ Funciona: Drive con permisos públicos, S3, Cloudinary, Unsplash, GCS, links de WhatsApp Business.
- ❌ Falla: Wikimedia (bloquea User-Agent ausente), enlaces privados, URLs detrás de login.

Si la descarga falla, el workflow devuelve `HTTP 502 {status: 'vision_error'}` y no inserta nada.

## Modelo de datos — `site_reports`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid PK | |
| `project_id` | uuid FK projects | proyecto al que pertenece |
| `reported_at` | timestamptz | momento del reporte |
| `reporter` | text | "arquitecto" / "jefe_obra" / "otro" |
| `photo_urls` | text[] | hasta 6 URLs |
| `observations` | text | notas libres del que reporta |
| `expected_phase` | text | fase que el reporter cree que está en curso |
| `detected_phase` | text | fase que Vision detecta en la foto |
| `progress_pct` | numeric | 0-100 estimado por Vision |
| `deviations` | jsonb[] | `[{type,description,severity}]` — desviaciones del plan/diseño |
| `issues_detected` | jsonb[] | `[{category,description,action_recommended,severity}]` |
| `vision_summary` | text | resumen 2-3 frases legible |
| `vision_raw` | jsonb | output bruto del LLM |
| `llm_model`, `llm_tokens_in`, `llm_tokens_out`, `llm_cost` | telemetry | |
| `alert_sent` | bool | si ya se envió email a Damián |
| `status` | text CHECK | `pending` \| `analyzed` \| `flagged` \| `reviewed` |

### Categorías de issues

- `safety` — riesgos de seguridad (acceso, EPIs, andamios, electricidad expuesta)
- `quality` — defectos visibles (juntas, replanteos, niveles)
- `materials` — material incorrecto/dañado
- `workmanship` — ejecución deficiente
- `other` — cualquier otra cosa relevante

### Tipos de deviation

- `plan` — la obra no está en la fase planificada
- `design` — lo construido no coincide con el design_option seleccionado
- `quality` — la calidad observada está por debajo de lo especificado

### Severities

`low` (informativo, no bloqueante) | `medium` (revisar pronto) | `high` (parar/decidir antes de continuar)

## Lógica de flagged

`status='flagged'` se asigna automáticamente si:
- Existe al menos un issue/deviation con `severity: high`, o
- Total de issues ≥ 3.

Cuando flagged → workflow envía email HTML inmediato a Damián con:
- Resumen Vision
- Lista de issues con badges de severity
- Lista de deviations
- Enlaces directos a las fotos
- ID del reporte para futura referencia

## Queries útiles

### Reportes pendientes de revisar (flagged)

```sql
SELECT sr.id, p.name AS proyecto, sr.reported_at, sr.detected_phase,
       sr.progress_pct, jsonb_array_length(sr.issues_detected) AS issues,
       jsonb_array_length(sr.deviations) AS devs, sr.vision_summary
FROM site_reports sr
JOIN projects p ON p.id = sr.project_id
WHERE sr.status = 'flagged'
ORDER BY sr.reported_at DESC;
```

### Historial de un proyecto

```sql
SELECT reported_at, detected_phase, progress_pct,
       jsonb_array_length(issues_detected) AS issues_count,
       LEFT(vision_summary, 120) AS preview
FROM site_reports
WHERE project_id = '<uuid>'
ORDER BY reported_at;
```

### Coste mensual de Vision

```sql
SELECT date_trunc('month', reported_at) AS mes,
       count(*) AS reportes,
       sum(llm_cost) AS coste_eur
FROM site_reports
GROUP BY 1 ORDER BY 1 DESC;
```

## Coste estimado

GPT-4o con visión, imagen `detail: high`:
- ~700-1200 tokens in (prompt + análisis imagen)
- ~300-600 tokens out (JSON estructurado)
- **~$0.005 - $0.012 por reporte**

Una visita semanal con 3 fotos → ~$0.015 → **~$0.06 al mes por proyecto activo**. Despreciable.

## Próximas iteraciones (fase 2)

1. **Trigger Gmail**: el jefe de obra manda foto por email con asunto `[obra <project_name>]`; Gmail trigger en n8n auto-procesa y descarga adjunto a Drive antes de invocar el webhook.
2. **WhatsApp via Evolution API**: ruta paralela para que el jefe de obra envíe foto sin email.
3. **Detección automática del proyecto**: si la foto incluye geolocalización EXIF + tenemos `projects.coordinates`, auto-asignar `project_id`.
4. **Cron semanal de resumen**: domingo manda email con todas las obras activas, su último reporte y progreso vs plan.
5. **Comparación temporal**: si hay reporte previo de la misma fase, comparar progress_pct para detectar parones.

## Espacio para Damián

```
## Cómo capturo fotos en obra

- Móvil: ...
- Drive folder por proyecto: ...
- Convención de nombres: ...

## Quién puede reportar

- Solo yo (arquitecto): ...
- Jefe de obra de Pepe (cuando confíe): ...
```
