# `agent_anomaly_detector` — Detección estadística de anomalías

## Estado

- **Migración 015** aplicada: `anomalies_detected` con UNIQUE `(entity_type, entity_id, anomaly_type)` para idempotencia.
- **2 workflows construidos y activos**:
  - `cron_anomaly_detect` (`RHrP8BowouYVCKjz`) — diario 06:00 + manual.
  - `anomaly_review` (`lk6KnCGUdwWlKD7i`) — marcar reviewed/accepted/dismissed/escalated.
- **8 heurísticas** sobre datos acumulados. Verificadas sin errores (todas devuelven 0 con BD limpia).
- **Última revisión**: 2026-04-25.

## Por qué importa

Tras construir 12+ tablas de negocio (invoices, certifications, site_reports, aftercare_incidents, permit_applications, trade_quotes…), hay suficientes datos para detectar patrones inusuales sin esperar a que un humano los note. El detector corre cada noche, marca anomalías nuevas con UNIQUE constraint para no duplicar, y manda un único email cada mañana.

## Heurísticas activas

Una sola query SQL con CTEs encadenados ejecuta los 8 detectores en una transacción:

| # | Detector | Entidad | Severity | Lógica |
|---|---|---|---|---|
| 1 | `invoice_above_median_for_trade` | invoice | high | Factura > 2× mediana de su trade_type (n≥5 históricas) |
| 2 | `invoice_low_ocr_confidence` | invoice | low | OCR confidence=low + status=pending_review (últimos 30d) |
| 3 | `invoice_unusual_vat_rate` | invoice | medium | IVA distinto de 21/10/4/0 |
| 4 | `budget_overrun_critical` | project | critical | Total facturado > estimado × 1.40 (proyecto activo) |
| 5 | `aftercare_open_too_long` | aftercare | high | Urgent>3d / High>14d / Medium>30d sin resolver |
| 6 | `permit_severely_overdue` | permit | high | Submitted_at + (expected×2) < now |
| 7 | `progress_regression` | site_report | medium | progress_pct cae > 5pp respecto al report anterior (14d) |
| 8 | `quote_no_reply_14d` | trade_quote | low | Status=requested, request_sent_at < now-14d |

Cada heurística usa `INSERT ... ON CONFLICT DO NOTHING` sobre la UNIQUE constraint, garantizando que ejecutar el cron 100 veces produce el mismo estado que ejecutarlo una.

## Workflows

### `cron_anomaly_detect`

- **Schedule**: diario 06:00.
- **Manual**: `POST /webhook/trigger-anomaly-detect` con `X-API-Key`.
- Una sola SQL agregada con 8 CTEs (cada uno un INSERT con RETURNING).
- Si total_new > 0: carga las anomalías → email HTML con tabla coloreada por severity.
- Marca todas las nuevas como `alert_sent=true`.
- Log en activity_log.

Email contiene 7 columnas: severity badge, proyecto, entidad+tipo, descripción, baseline, observado, deviation%.

### `anomaly_review`

- `POST /webhook/anomaly-review` con `X-API-Key`.
- Body: `{ anomaly_id, status, reviewed_by?, notes? }`.
- `status ∈ {reviewed, accepted, dismissed, escalated}`.
- UPDATE → trigger marca `reviewed_at` automáticamente.
- 404 si no existe, 400 si status inválido.

## Modelo de datos — `anomalies_detected`

| Campo | Descripción |
|---|---|
| `id` | uuid PK |
| `project_id`, `entity_type`, `entity_id` | a qué se refiere |
| `anomaly_type` | identifica la heurística que la detectó (string libre) |
| `severity` | info / low / medium / high / critical |
| `description` | texto legible para el email |
| `baseline_value`, `observed_value`, `deviation_pct` | cifras numéricas cuando aplica |
| `reference_set` | qué se usó como baseline (ej. "Mediana 5 facturas mismo trade_type") |
| `status` | new → reviewed / accepted / dismissed / escalated |
| `reviewed_by`, `reviewed_at` | auditoría |
| `alert_sent` | si ya se incluyó en email diario |
| `notes` | comentarios al revisar |

## Queries útiles

### Anomalías nuevas pendientes de revisar

```sql
SELECT a.severity, a.anomaly_type, a.description, p.name AS proyecto,
       a.observed_value, a.deviation_pct, a.detected_at
FROM anomalies_detected a
LEFT JOIN projects p ON p.id = a.project_id
WHERE a.status = 'new'
ORDER BY
  CASE a.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1
                  WHEN 'medium' THEN 2 ELSE 3 END,
  a.detected_at DESC;
```

### Anomalías más frecuentes por tipo (últimos 90d)

```sql
SELECT anomaly_type, count(*) AS frecuencia,
       count(*) FILTER (WHERE status='dismissed') AS descartadas,
       count(*) FILTER (WHERE status='accepted')  AS aceptadas
FROM anomalies_detected
WHERE detected_at > now() - INTERVAL '90 days'
GROUP BY anomaly_type
ORDER BY frecuencia DESC;
```

### False-positive rate por tipo (calibración futura)

```sql
SELECT anomaly_type,
       round(count(*) FILTER (WHERE status='dismissed')::float / count(*) * 100) AS pct_descartadas
FROM anomalies_detected
WHERE status IN ('reviewed','accepted','dismissed','escalated')
GROUP BY anomaly_type
HAVING count(*) >= 5
ORDER BY pct_descartadas DESC;
```

## Próximas iteraciones

1. **Más heurísticas**: revisión automática de SLA por gremio (cuando haya histórico), detección de gaps temporales en site_reports (proyecto sin avance > 30d), correlación entre cost overrun y site_reports flagged.
2. **Calibración por tipo**: si `pct_descartadas > 80%` para un anomaly_type, subir el umbral automáticamente.
3. **LLM contextual**: para anomalías high/critical, pasar el contexto al LLM y obtener un resumen + acción recomendada antes del email.
4. **Auto-acción en algunas anomalías**: si `quote_no_reply_14d` → re-enviar email automático al gremio (con cron auxiliar).
5. **Dashboard**: vista web con todas las anomalías históricas, false positive rate por tipo, tiempos medios de revisión.

## Espacio para Damián

```
## Heurísticas a añadir

- ...

## Umbrales que conviene ajustar tras un mes de uso

- ...
```
