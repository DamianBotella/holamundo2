# `agent_financial_tracker` — Control financiero de obra

## Estado

- **Migración 012** aplicada: `invoices` (29 columnas) + `certifications` (15 columnas) + 2 triggers `updated_at`.
- **4 workflows construidos y activos**:
  - `agent_financial_tracker` (`LEspjLl6VEHPclPG`) — OCR de facturas vía Vision.
  - `cron_financial_review` (`eg57HYIXCfcTbj7F`) — reconciliación semanal (lunes 08:00).
  - `certification_register` (`eJhIqyn6AxnNmpeS`) — registrar certificación al cliente.
  - `certification_payment` (`UDrKZWsbKDPXVSBX`) — registrar pago recibido.
- **Verificación E2E**: register → partially_paid → paid funcionan correctamente. Reconciliación dispara email con tabla coloreada.
- **Última revisión**: 2026-04-25.

## Por qué cierra el ciclo financiero

- `agent_costs` estima el coste total al inicio del proyecto.
- Durante la obra llegan facturas reales (gremios, materiales, servicios) y se emiten certificaciones parciales al cliente.
- Sin tracking, las desviaciones aparecen al final cuando ya no se pueden corregir.

`agent_financial_tracker` mantiene en tiempo real:
- **Total facturado**: lo que la obra le cuesta al estudio.
- **Total certificado**: lo que se le ha facturado al cliente.
- **Margen actual**: certificado − facturado (lo que el estudio cobra menos lo que paga).
- **Desviación %**: facturado real vs cost_estimate.

## Workflows

### `agent_financial_tracker` — OCR de facturas

- Endpoint: `POST /webhook/invoice-upload` con `X-API-Key`.
- Body: `{ project_id, photo_url, trade_type?, notes? }` (foto pública JPG/PNG/PDF — ver limitación de URLs en `agent_site_monitor.md`).
- Flujo:
  1. Valida input + foto URL `http(s)`.
  2. HTTP Request a OpenAI Vision (gpt-4o, detail:high, 1500 max_tokens).
  3. Prompt extrae: supplier_name, supplier_nif, invoice_number, invoice_date, base_amount, vat_amount, total_amount, vat_rate, category, trade_type, description, line_items, confidence.
  4. INSERT `invoices` con status `pending_review` (Damián tiene que aprobar antes de que cuente como compromiso real).
- Respuesta `201`: `{ status:'ocr_done', invoice_id, supplier, total, confidence, invoice_status }`.
- Respuesta `502`: descarga de imagen falló (URL inaccesible para OpenAI).

Coste OCR: ~$0.005-0.012 por factura (mismo modelo que `agent_site_monitor`).

### `certification_register` — emitir certificación

- Endpoint: `POST /webhook/certification-register` con `X-API-Key`.
- Body: `{ project_id, percentage, amount?, description?, due_date? }`.
  - Si `amount` no se pasa: se calcula como `cost_estimated × (percentage/100)`.
  - Si `cost_estimated` no existe: se requiere `amount` explícito.
- Flujo:
  1. Valida `percentage` (1-100).
  2. Calcula `next_version` automático (max+1).
  3. INSERT `certifications` con status `issued`.
- Respuesta `201`: `{ status:'created', certification_id, version, percentage, amount, certification_status:'issued', issued_at }`.

### `certification_payment` — aplicar pago

- Endpoint: `POST /webhook/certification-payment` con `X-API-Key`.
- Body: `{ certification_id, paid_amount, paid_at?, payment_reference? }`.
- Flujo: UPDATE `certifications` sumando `paid_amount` al acumulado:
  - Si total cubre el importe → status pasa a `paid`.
  - Si parcial → status `partially_paid`.
  - `paid_at` solo se establece la primera vez.
- Respuesta `200`: `{ status:'paid_applied', certification_id, version, amount, paid_total, certification_status, payment_reference }`.

### `cron_financial_review` — reconciliación semanal

- Schedule: lunes 08:00.
- Manual: `POST /webhook/trigger-financial-review` con auth.
- SQL agregada por proyecto activo (no en intake/briefing_done/completed/archived):
  - `estimated` = última versión de `cost_estimates`.
  - `total_facturado` = suma de `invoices.total_amount`.
  - `total_certificado` = suma de `certifications.amount` (no canceladas).
  - `total_cobrado` = suma de `certifications.paid_amount`.
  - `deviation_pct` = `(facturado − estimado) / estimado × 100`.
  - `margin_now` = certificado − facturado.
- Email HTML con tabla coloreada:
  - 🔴 **CRÍTICO** si deviation_pct > 30%.
  - 🟡 **DESVÍO** si > 10%.
  - 🟢 **OK** otros casos.
- Alertas adicionales: facturas pending_review > 0, disputed > 0, OCR low_confidence > 0.

## Modelo de datos

### `invoices` — campos clave

| Campo | Descripción |
|---|---|
| `supplier_name`, `supplier_nif`, `invoice_number`, `invoice_date` | Identificación |
| `base_amount`, `vat_amount`, `total_amount`, `vat_rate` | Importes |
| `category` | `materiales` \| `mano_obra` \| `servicios` \| `otros` |
| `trade_type` | gremio que emitió la factura (cuando aplica) |
| `photo_url` | URL pública de la foto/PDF original |
| `ocr_*` | resultado OCR + confianza (low/medium/high) |
| `status` | `pending_review` → `approved` / `disputed` / `paid` / `rejected` |
| `approved_by`, `approved_at`, `paid_at`, `paid_amount` | Trazabilidad |

### `certifications` — campos clave

| Campo | Descripción |
|---|---|
| `version` | número incremental por proyecto (UNIQUE constraint con project_id) |
| `percentage` | % de obra certificado en esta certificación (no acumulado) |
| `amount` | importe de esta certificación |
| `status` | `issued` → `sent` → `partially_paid` → `paid` (o `disputed` / `cancelled`) |
| `due_date` | fecha de vencimiento |
| `paid_at`, `paid_amount`, `payment_reference` | Pago |

## Queries útiles

### Estado financiero de un proyecto

```sql
WITH ce AS (
  SELECT total_estimated FROM cost_estimates
   WHERE project_id = '<uuid>' ORDER BY version DESC LIMIT 1
)
SELECT
  ce.total_estimated AS estimado,
  COALESCE((SELECT sum(total_amount) FROM invoices WHERE project_id = '<uuid>'), 0)        AS facturado,
  COALESCE((SELECT sum(amount) FROM certifications WHERE project_id = '<uuid>' AND status != 'cancelled'), 0) AS certificado,
  COALESCE((SELECT sum(paid_amount) FROM certifications WHERE project_id = '<uuid>'), 0)   AS cobrado,
  COALESCE((SELECT sum(amount) FROM certifications WHERE project_id = '<uuid>' AND status != 'cancelled'), 0) -
  COALESCE((SELECT sum(total_amount) FROM invoices WHERE project_id = '<uuid>'), 0)        AS margen_actual
FROM ce;
```

### Facturas pendientes de aprobar

```sql
SELECT i.invoice_date, i.supplier_name, i.total_amount, i.ocr_confidence,
       LEFT(i.ocr_summary, 80) AS preview, p.name AS proyecto
FROM invoices i
JOIN projects p ON p.id = i.project_id
WHERE i.status = 'pending_review'
ORDER BY i.invoice_date DESC;
```

### Aprobar factura

```sql
UPDATE invoices
   SET status = 'approved', approved_by = 'damian', approved_at = now()
 WHERE id = '<uuid>';
```

### Marcar factura como pagada (al pagar al gremio)

```sql
UPDATE invoices
   SET status = 'paid', paid_at = now(), paid_amount = total_amount
 WHERE id = '<uuid>';
```

### Coste mensual de OCR

```sql
SELECT date_trunc('month', created_at) AS mes,
       count(*) AS facturas,
       sum(llm_cost) AS coste_eur_ocr
FROM invoices
WHERE llm_cost IS NOT NULL
GROUP BY 1 ORDER BY 1 DESC;
```

## ✅ Aprobación por email (CONSTRUIDA 2026-04-25)

**Migración 016** añadió `invoices.webhook_token` (auto-generado por defecto). El flujo `agent_financial_tracker` ahora envía un email HTML tras el OCR con:
- Tabla con todos los campos detectados (proveedor, NIF, número, fecha, base, IVA, total, categoría, gremio).
- Badge coloreado de confianza OCR (high/medium/low).
- Enlace a la foto/PDF original.
- 3 botones: ✓ **Aprobar** (verde), ⚠ **Disputar** (ámbar), ✗ **Rechazar** (rojo).

Cada botón apunta a `GET /webhook/invoice-decision?id=<uuid>&token=<token>&decision=approved|disputed|rejected` (workflow `invoice_decision` ID `NwvzKfuYrfImMUi4`).

El workflow `invoice_decision`:
- Valida que `decision ∈ {approved, disputed, rejected}` → 400 si no.
- UPDATE `invoices` matching `id + webhook_token` (404 si no coincide).
- Si `decision='approved'` → marca `approved_by='damian'` + `approved_at=now()`.
- Devuelve **HTML** legible al navegador del clic (no JSON), con el resultado coloreado.

E2E verificado 2026-04-25: approve OK con HTML verde, decision inválida → 400, token bad → 404.

## Próximas iteraciones

1. ~~Aprobación por email~~ ✅ construida.
2. **Hook desde `agent_costs`**: al confirmar el cost_estimate, generar plantilla de certificaciones esperadas (3-4 hitos típicos).
3. **OCR de extractos bancarios**: cargar movimientos bancarios y reconciliar pagos automáticamente con `certifications.payment_reference`.
4. **Predicción de fin de obra**: cruzar progress_pct de `site_reports` con % facturado para detectar parones financieros antes de que se queden sin liquidez.
5. **Alerta cuando margen actual < 0**: hoy el cron lo muestra coloreado pero no alerta separadamente.

## Espacio para Damián

```
## Mi flujo financiero actual

- Recibo factura del gremio: ...
- Apruebo (cómo decido): ...
- Pago al gremio: ...
- Certifico al cliente: ...
- Cobro del cliente: ...

## Hitos típicos de certificación

- Inicio (firma contrato): X% del total
- Fin demolición + replanteo: ...
- Fin instalaciones: ...
- Recepción provisional: ...
- Recepción definitiva: ...
```
