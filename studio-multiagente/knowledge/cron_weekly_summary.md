# `cron_weekly_summary` — Panorama semanal de proyectos activos

## Estado

- **Workflow** `cron_weekly_summary` (`HFmOG0ouMuG1KCmb`) activo.
- **Schedule**: lunes 08:30 (justo después de `cron_financial_review` a las 08:00).
- **Manual**: `POST /webhook/trigger-weekly-summary` con `X-API-Key`.
- **Verificación**: trigger manual devolvió 200 + log_id, email enviado.
- **Última revisión**: 2026-04-25.

## Por qué importa

Damián tiene 30+ workflows alertando por canales separados (financial, permits, site reports, scope creep, ip alerts, drive cleanup…). El lunes a primera hora necesita **una sola vista** que le diga "qué proyectos requieren mi atención esta semana" sin leer 5 emails distintos.

## Qué hace

Una sola SQL agregada calcula por cada proyecto activo (no en `completed`/`archived`):

| Métrica | Fuente | Significado |
|---|---|---|
| `days_in_phase` | `projects.updated_at` | Días desde el último avance de fase |
| `pending_approvals` | `approvals.status='pending'` | Aprobaciones esperando a Damián |
| `reports_7d` | `site_reports.reported_at > now()-7d` | Visitas vision esta semana |
| `reports_flagged_7d` | `site_reports.status='flagged'` 7d | Visitas con incidencia high |
| `invoices_7d` | `invoices.created_at > now()-7d` | Facturas escaneadas esta semana |
| `invoices_pending` | `invoices.status='pending_review'` | Facturas por aprobar |
| `permits_active` | `permit_applications` no terminales | Expedientes vivos |
| `permits_subsanation` | `permit_applications.status='requires_subsanation'` | Requerimientos urgentes |
| `reg_tasks_review` | `regulatory_tasks.status='requires_review'` | Trámites a revisar |
| `estimated`/`certified`/`billed` | financial tables | Cifras económicas |
| `margin_now` | certified − billed | Margen actual |

Y un **`flag_score`** que pondera urgencia:
- `+5` si proyecto en `intake` con > 3 días sin avanzar (proyecto huérfano).
- `+4` si > 14 días sin avance.
- `+3` por cada site_report flagged en últimos 7 días.
- `+2` por cada permit en subsanación.
- `+1` por cada aprobación pendiente.

## Email recibido

```
Asunto: ArquitAI — resumen semanal: 5 proyectos (1 atencion, 2 revisar)

Resumen semanal de proyectos activos
Total activos: 5 | Requieren atencion: 1 | Por revisar: 2

[tabla 11 columnas con badges coloreados]
```

Badges:
- 🔴 `ATENCION` (flag_score ≥ 5)
- 🟡 `REVISAR` (flag_score 2-4)
- 🟢 `OK` (flag_score < 2)

Cada fila incluye: nombre, ciudad/tipo, fase + días, contadores 7d, financiero (estimado/certificado/facturado/margen) y lista compacta de alertas.

## Ordenación

La tabla se ordena por `flag_score DESC` luego `days_in_phase DESC`. Lo más urgente arriba.

## Queries útiles fuera del cron

### Ver el snapshot actual sin esperar al lunes

```bash
curl -X POST https://n8n-n8n.zzeluw.easypanel.host/webhook/trigger-weekly-summary \
  -H "X-API-Key: ..." -d '{}'
```

### Reproducir el cálculo en SQL

```sql
-- Ver tabla completa fuera del cron (sin filtros)
SELECT name, current_phase, EXTRACT(EPOCH FROM (now()-updated_at))/86400 AS dias_fase
FROM projects
WHERE current_phase NOT IN ('completed','archived')
ORDER BY dias_fase DESC;
```

## Ampliación 2026-04-25 — pathology + aftercare + anomalies

Tras construir agentes nuevos, el resumen integra ahora estas señales adicionales por proyecto activo:

- `pathologies_open` / `pathologies_critical` (severity high/critical, status no terminal)
- `aftercare_open` / `aftercare_urgent` (status no terminal)
- `anomalies_new` / `anomalies_critical` (status='new', severity high/critical)

Y el `flag_score` se incrementa por:
- patologías críticas (×4)
- aftercare urgentes (×5)
- anomalías críticas (×3)

Las flags aparecen en la columna "Alertas" coloreadas en rojo cuando hay críticas, o en gris si solo son normales.

## Próximas iteraciones

1. **Detalle por proyecto en clic**: link en cada fila a una vista UI cuando exista portal web.
2. **Resumen mensual**: agregado por mes con tendencia (proyectos cerrados, margen acumulado, etc.).
3. **Tarjeta Slack/Telegram**: misma info en formato más corto para revisión rápida en móvil.
4. **Predicción**: añadir columna "ETA cierre" basada en velocidad histórica del proyecto y plan original.
