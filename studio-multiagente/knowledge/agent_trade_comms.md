# `agent_trade_comms` — Comunicación con gremios (email MVP)

## Estado

- **Migración 013** aplicada: `trade_quotes` (20 cols) + trigger touch.
- **2 workflows construidos y activos**:
  - `trade_quote_request` (`C8LmBilsqMTGNFut`) — solicita presupuesto al gremio por email.
  - `trade_quote_reply` (`NmZApRC3Oj7nkRIS`) — registra la respuesta (gremio rellena formulario o Damián copia/pega).
- **Verificación E2E**: request → 201 con reply_url + token; reply → status pasa a `quoted`, email automático a Damián.
- **Última revisión**: 2026-04-25.

## Por qué importa

Pedir presupuestos a 3-4 gremios y comparar respuestas consume horas. Esta versión MVP usa email + un token único por solicitud para que la respuesta entre por webhook (sin Evolution API). Cuando se añada WhatsApp, los gremios podrán responder por ese canal y entrará por el mismo `trade_quote_reply`.

## Workflows

### `trade_quote_request` — enviar solicitud

- Endpoint: `POST /webhook/trade-quote-request` con `X-API-Key`.
- Body:
```json
{
  "project_id": "uuid",
  "trade_request_id": "uuid|null",
  "trade_type": "fontaneria|electricidad|...",
  "supplier_name": "Pepe Fontanero",
  "supplier_email": "pepe@fontaneros.es",
  "supplier_phone": "+34...",
  "scope_description": "Texto del trabajo a presupuestar",
  "deadline_days": 7
}
```
- Flujo:
  1. Valida input.
  2. INSERT en `trade_quotes` con status `requested` y un `webhook_token` único.
  3. Carga datos del proyecto (nombre, ubicación, área).
  4. Construye email HTML con scope + link al formulario de respuesta (incluye token).
  5. Envía email al gremio con CC a Damián.
- Respuesta `201`:
```json
{
  "status": "sent",
  "quote_id": "uuid",
  "supplier": "...",
  "supplier_status": "requested",
  "reply_url": "https://.../webhook/trade-quote-reply?token=..."
}
```

### `trade_quote_reply` — registrar respuesta

- Endpoint: `POST /webhook/trade-quote-reply?token=<token>` (sin auth — el token es el control de acceso).
- Body:
```json
{
  "amount": 650,
  "currency": "EUR",
  "payment_terms": "50%/50%",
  "estimated_duration": "1 día",
  "reply_text": "Notas adicionales del gremio",
  "status": "quoted|rejected_by_supplier|withdrawn"
}
```
- Flujo:
  1. Extrae token (de query o body).
  2. UPDATE `trade_quotes` matching `webhook_token`. Si no encuentra → 404.
  3. Email automático a Damián con la respuesta.
- Respuesta `200`: `{ status:'received', quote_id, supplier, quote_status, message:'Gracias...' }`.

## Estado del flujo

```
requested  →  quoted              →  accepted
                  ↓                     ↑
              rejected_by_supplier      |
                                        |
              rejected_by_us  ----------+
              expired         (cron futuro)
              withdrawn       (gremio retira)
```

## Modelo de datos — `trade_quotes`

| Campo | Descripción |
|---|---|
| `project_id`, `trade_request_id`, `trade_type` | Contexto |
| `supplier_*` | Identificación gremio |
| `request_sent_at`, `request_email_id` | Trazabilidad envío |
| `amount`, `currency`, `payment_terms`, `estimated_duration` | Respuesta económica |
| `reply_text`, `reply_received_at` | Texto respuesta + timestamp |
| `webhook_token` | Token único para reply (auth) |
| `status` | requested → quoted / rejected_by_supplier / accepted / withdrawn / expired |

## Queries útiles

### Comparativo de respuestas para un proyecto

```sql
SELECT supplier_name, status, amount, currency, payment_terms,
       estimated_duration,
       EXTRACT(EPOCH FROM (reply_received_at - request_sent_at))/3600 AS horas_respuesta,
       LEFT(reply_text, 100) AS preview
FROM trade_quotes
WHERE project_id = '<uuid>' AND status = 'quoted'
ORDER BY amount;
```

### Gremios con mejor tiempo de respuesta

```sql
SELECT supplier_name, count(*) AS solicitudes,
       round(avg(EXTRACT(EPOCH FROM (reply_received_at - request_sent_at))/3600)) AS horas_promedio,
       count(*) FILTER (WHERE status = 'quoted')::float / count(*) AS tasa_respuesta
FROM trade_quotes
WHERE request_sent_at IS NOT NULL
GROUP BY supplier_name
ORDER BY horas_promedio;
```

### Respuestas pendientes > N días

```sql
SELECT supplier_name, supplier_email,
       EXTRACT(EPOCH FROM (now() - request_sent_at))/86400 AS dias_esperando
FROM trade_quotes
WHERE status = 'requested' AND request_sent_at < now() - INTERVAL '7 days'
ORDER BY request_sent_at;
```

## Próximas iteraciones

1. **Cron expiry**: si una solicitud lleva > N días sin respuesta, marcar `expired` y notificar.
2. **Re-envío automático**: si `expired`, ofrecer re-enviar al mismo gremio o disparar a otro.
3. **Aceptación de presupuesto**: workflow `trade_quote_accept` que pase status a `accepted` y, opcionalmente, cree el correspondiente `trade_request`.
4. **WhatsApp via Evolution API**: misma tabla, mismo token, canal diferente para envío + reply.
5. **OCR de presupuestos PDF**: si el gremio responde con PDF adjunto, parsearlo con Vision (similar a `agent_financial_tracker`).

## Espacio para Damián

```
## Plantillas de scope típico

- Fontaneria — sustitucion bajante: ...
- Electricidad — instalacion completa baño: ...
- ...

## Gremios habituales

- nombre / email / teléfono / especialidad: ...
```
