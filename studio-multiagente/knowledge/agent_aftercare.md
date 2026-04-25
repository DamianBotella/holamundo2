# `agent_aftercare` — Postventa y garantías LOE

## Estado

- **Migración 013** aplicada: `aftercare_incidents` (30 cols) + `projects.handover_date` + trigger touch.
- **3 workflows construidos y activos**:
  - `aftercare_submit` (`GkcU8G1y3gFOeZp9`) — recibe incidencia, Vision clasifica + LOE.
  - `aftercare_assign_resolve` (`xdkQuIdOwLZw68sK`) — `aftercare-assign` + `aftercare-resolve` en un workflow.
  - `cron_aftercare_review` (`hcXJyJB8hqevVxW2`) — diario 09:30, alerta de incidencias abiertas.
- **Verificación E2E**: incidencia "mancha humedad techo baño" → Vision clasificó `habitabilidad / fontaneria / medium / 3 años LOE / under_warranty`. Asignar → resolver funcionan.
- **Última revisión**: 2026-04-25.

## Por qué importa

LOE obliga a 1/3/10 años de garantía tras la entrega:
- **1 año**: acabados (pintura, juntas, sellados, mecanismos).
- **3 años**: habitabilidad e instalaciones (humedades no estructurales, fugas, ventilación, acústica).
- **10 años**: estructura (fisuras estructurales, cubierta, fachadas portantes).

Las incidencias post-entrega llegan dispersas por canales (WhatsApp del cliente, llamada, email) y se gestionan mal: no hay registro de cuándo se reportaron, qué gremio se ocupó, qué se resolvió. Esto crea fricción con clientes y deja al estudio sin defensa documental ante reclamaciones.

`agent_aftercare` resuelve esto registrando cada incidencia con clasificación automática + asignación + resolución, **incluyendo evidencia visual**.

## Workflows

### `aftercare_submit` — registro + clasificación con Vision

- Endpoint: `POST /webhook/aftercare-submit` con `X-API-Key`.
- Body:
```json
{
  "project_id": "uuid",
  "description": "texto del cliente describiendo la incidencia (>5 chars)",
  "photo_url": "https://..." ó "photo_urls": ["url1", "url2"]  (hasta 5),
  "reporter": "cliente|arquitecto|gremio|otro",
  "client_contact": "email/teléfono opcional"
}
```
- Flujo:
  1. Valida input.
  2. Carga proyecto + `handover_date` + `days_since_handover`.
  3. Llama a OpenAI Vision (gpt-4o, detail:high) con foto + descripción.
  4. LLM devuelve JSON: `category`, `responsible_trade`, `severity`, `loe_period`, `vision_summary`, `action_recommended`, `confidence`.
  5. Calcula `under_warranty` = `days_since_handover ≤ loe_period × 365` (true si no hay handover_date).
  6. INSERT en `aftercare_incidents` con `status='reported'`.
  7. Email HTML inmediato a Damián con badges severidad y garantía.
- Respuesta `201`: `{ status:'classified', incident_id, category, responsible_trade, severity, loe_period, under_warranty, vision_summary }`.
- Respuesta `502`: error en Vision (URL inaccesible, etc.).

Coste: ~$0.005-0.012 por incidencia.

### `aftercare_assign_resolve` — asignar + resolver (mismo workflow, 2 webhooks)

**`POST /webhook/aftercare-assign`** con `X-API-Key`.
- Body: `{ incident_id, assigned_to, notify_email_to?, notes? }`.
- Marca status `assigned`, registra `assigned_at` y `assigned_to`.
- **Notificación automática al gremio (2026-04-25)**: si el `assigned_to` contiene un email entre `<...>` (formato `Pepe Gremio <pepe@email.com>`) o se pasa `notify_email_to` explícito, el workflow envía un email al gremio con la incidencia: severity, badge garantía LOE, descripción del cliente, análisis Vision, acción recomendada, fotos enlazadas. CC a Damián. Response incluye `gremio_notified: true|false` para confirmar.

**`POST /webhook/aftercare-resolve`** con `X-API-Key`.
- Body: `{ incident_id, resolution_notes, evidence_urls?, status?:'closed' }`.
- Marca status `resolved` (o `closed` si se pasa explícito), registra `resolved_at` y `resolved_evidence` (array de URLs).

### `cron_aftercare_followup` — incidencias asignadas sin avance (2026-04-25)

- **ID**: `rO1sOgzJ3WYvuLLG`. Activo.
- **Schedule**: diario 10:00 + manual `POST /webhook/trigger-aftercare-followup`.
- Detecta incidencias con `status='assigned'` y `assigned_at < now() - 4 days`.
- Email tabla a Damián con: severity badge, proyecto/categoría, gremio asignado, días sin avanzar, descripción.
- Si no hay stuck: silent noOp.

Útil cuando el gremio recibió la asignación pero nunca pasó el incidente a `in_progress` ni `resolved`. Damián decide si volver a contactar al gremio o reasignar.

### `cron_aftercare_review` — alertas diarias

- Schedule: 09:30 cada día.
- Manual: `POST /webhook/trigger-aftercare-review` con auth.
- Calcula `urgency_score` por incidencia abierta:
  - severity urgent +100, high +50, medium +20, low +5
  - +30 si lleva > 14 días sin avanzar
  - +20 si está asignada hace > 7 días sin resolver
  - −50 si está fuera de garantía (menos urgente)
- Email HTML con badges + lista de alertas por incidencia.
- Si no hay pendientes: silent noOp.

## Modelo de datos — `aftercare_incidents`

| Campo | Descripción |
|---|---|
| `project_id`, `client_id` | proyecto/cliente |
| `reported_at`, `reporter` | quién y cuándo (cliente/arquitecto/gremio/otro) |
| `description`, `photo_urls` | texto + fotos del cliente |
| `category` | acabado \| habitabilidad \| estructura \| instalaciones \| otro |
| `responsible_trade` | gremio que debería intervenir |
| `severity` | low \| medium \| high \| urgent |
| `loe_period` | 1, 3 o 10 años |
| `under_warranty` | calculado desde `handover_date` + `loe_period` |
| `days_since_handover` | snapshot al reportar |
| `status` | reported → assigned → in_progress → resolved / closed / escalated / disputed |
| `assigned_to`, `assigned_at` | a quién y cuándo |
| `resolved_at`, `resolved_evidence`, `resolution_notes` | cierre |
| `vision_*`, `llm_*` | output IA y telemetry |

## Queries útiles

### Incidencias abiertas por urgencia

```sql
SELECT
  ai.severity, ai.category, ai.responsible_trade,
  EXTRACT(EPOCH FROM (now() - ai.reported_at))/86400 AS dias_abierta,
  ai.under_warranty, ai.loe_period,
  p.name AS proyecto, ai.assigned_to,
  LEFT(ai.description, 100) AS preview
FROM aftercare_incidents ai
JOIN projects p ON p.id = ai.project_id
WHERE ai.status NOT IN ('resolved','closed','disputed')
ORDER BY
  CASE ai.severity WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
  ai.reported_at;
```

### SLA por gremio (tiempos medios de resolución)

```sql
SELECT responsible_trade, count(*) AS total,
       round(avg(EXTRACT(EPOCH FROM (resolved_at - reported_at))/86400)) AS dias_promedio_resolucion
FROM aftercare_incidents
WHERE resolved_at IS NOT NULL
GROUP BY responsible_trade
ORDER BY total DESC;
```

### Defensa LOE: incidencias resueltas en garantía con evidencia

```sql
SELECT p.name AS proyecto, ai.reported_at, ai.category, ai.severity,
       ai.responsible_trade, ai.assigned_to,
       ai.resolved_at, ai.resolution_notes,
       array_length(ai.resolved_evidence, 1) AS evidencias
FROM aftercare_incidents ai
JOIN projects p ON p.id = ai.project_id
WHERE ai.under_warranty = true AND ai.status IN ('resolved','closed')
ORDER BY ai.reported_at DESC;
```

## Integración con `trade_quote_request`

Cuando una incidencia requiere presupuesto del gremio antes de la reparación:

```bash
# 1. Tras aftercare_submit (incidencia clasificada con responsible_trade)
# 2. Damián decide pedir presupuesto al gremio:
curl -X POST .../webhook/trade-quote-request -H "X-API-Key: ..." -d '{
  "project_id": "<uuid>",
  "trade_type": "fontaneria",
  "supplier_name": "Pepe Fontanero",
  "supplier_email": "pepe@fontaneros.es",
  "scope_description": "Mancha de humedad en techo baño...",
  "deadline_days": 5
}'
```

Ver `agent_trade_comms.md` para detalle.

## Próximas iteraciones

1. **Endpoint público para clientes**: portal o link mágico para que el cliente reporte incidencias sin la API key (autenticación por token único por proyecto).
2. **Auto-asignación**: si Damián tiene un mapa "trade → contacto preferente", asignar automáticamente cuando severity ≤ medium.
3. **SLA breach detection**: si una incidencia urgent lleva > 24h sin asignar → email de escalado.
4. **Hook con `trade_quote_request`**: tras asignar, generar request de presupuesto automáticamente.
5. **Evidencia con Vision**: cuando se sube `evidence_urls` al resolver, comparar con foto inicial para confirmar resolución visual.

## Espacio para Damián

```
## Mis gremios habituales por especialidad

- Fontaneria: ...
- Electricidad: ...
- Albañilería: ...

## Política de SLA propia

- Urgent: respondo en < 24h, resuelvo en < 5d
- High: respondo en < 48h, resuelvo en < 14d
- ...
```
