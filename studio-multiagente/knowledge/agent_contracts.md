# `agent_contracts` — Generacion de contratos y actas firmables

## Estado

- **Migracion 022** aplicada: tabla `contracts` (23 cols).
- **2 workflows construidos y activos**:
  - `agent_contracts` (`Abwnfh4BtHPU9lHg`): genera Google Doc desde plantilla embebida.
  - `contract_mark_signed` (`QK640K7iJ9dPJATR`): marca contrato como firmado tras firma manual.
- **Verificacion E2E (2026-04-25/26)**: encargo profesional para proyecto Madrid -> Google Doc creado con cuerpo completo (URL devuelta), email a Damian con link revisable, fila en `contracts` con status='draft', expires_at=+60d. Mark signed -> status='signed' y signed_at automatico (touch trigger).

## Por que importa

ArquitAI sec 3.13 #15: cada proyecto tiene 3-6 documentos contractuales (encargo, contrato obra, contratos gremios, actas replanteo/recepcion, modificados). Generarlos es repetitivo y propenso a errores (fechas, importes, normativa). Las plantillas se almacenan en silos (carpetas Drive, Word del estudio). `agent_contracts` aporta:

- **Una plantilla por tipo** parametrizada con datos del proyecto (cliente, ubicacion, importe, fechas).
- **Generacion en Google Doc** (editable manualmente antes de firmar).
- **Tracking de estado** en BD: draft -> sent -> signed con timestamps.
- **Trazabilidad legal**: cada contrato queda asociado al `project_id` y conserva el doc_url + signed_doc_url + signature_hash.

Firma electronica integrada (DocuSign/FNMT) queda para fase 2 — MVP es manual.

## Tipos de contrato disponibles

| `contract_type` | Uso |
|---|---|
| `encargo_profesional` | Cliente <-> Arquitecto (DO + CSS, honorarios) |
| `contrato_cliente` | Contratista <-> Cliente (ejecucion obra, LOE 1/3/10) |
| `contrato_gremio` | Subcontratista <-> Contratista (alcance + ITA + RC) |
| `acta_replanteo` | Inicio efectivo de obra |
| `acta_recepcion_provisional` | Cierre obra, inicio plazo LOE |
| `acta_recepcion_definitiva` | Tras subsanacion incidencias |
| `modificado_obra` | Cambio de alcance economico/tecnico |
| `renuncia_garantia` | Cliente renuncia a recomendacion DF (libera responsabilidad) |
| `otros` | Placeholder editable |

Plantillas embebidas en el jsCode del nodo `Build Contract Content`. Para editar: modificar el switch `TPL[contract_type]`. Fase 2 movera plantillas a tabla `contract_templates`.

## Modelo de datos (`contracts`)

Campos clave:
- `parties` jsonb: `[{role, name, dni?, email?, address?}]`
- `template_used` text: `<contract_type>:v1`
- `doc_url`, `doc_id`, `pdf_url`: ubicacion del Google Doc generado
- `status`: draft -> ready_to_sign -> sent -> signed -> ...
- `signed_at`, `signer_email`, `signature_hash`, `signed_doc_url`: trazabilidad de firma
- `amount_eur`, `scope`, `expires_at`: datos comerciales

Trigger `contracts_touch` (BEFORE UPDATE): pone signed_at/sent_at automaticos cuando status cambia a signed/sent.

## Workflows

### `agent_contracts` — generar contrato

**Endpoint**: `POST /webhook/contract-generate` con `X-API-Key`.

**Body**:
```json
{
  "project_id": "<uuid>",
  "contract_type": "encargo_profesional",
  "parties": [
    {"role": "cliente", "name": "Maria Garcia", "dni": "12345678A", "email": "...", "address": "..."},
    {"role": "arquitecto", "name": "Damian Martinez", "email": "..."}
  ],
  "scope": "DO + CSS para reforma piso. Incluye proyecto basico, ejecucion, licencias, certificado fin de obra.",
  "amount_eur": 4800,
  "expires_days": 60,
  "notes": "..."
}
```

**Respuesta 201**:
```json
{
  "status": "created",
  "contract_id": "<uuid>",
  "title": "Encargo profesional — Reforma integral piso Embajadores",
  "doc_url": "https://docs.google.com/document/d/.../edit",
  "expires_at": "2026-06-24T..."
}
```

**Flujo**: webhook -> Load Architect Email -> Validate -> Load Project + Client (PII descifrado) -> Build Contract Content (TPL[type]) -> Create Google Doc (titulo) -> Insert Doc Body HTTP (batchUpdate API con cuerpo) -> Insert Contract Row (BD) -> Notify Damian (email con link revisable) -> Respond 201.

### `contract_mark_signed` — marcar firmado

**Endpoint**: `POST /webhook/contract-signed` con `X-API-Key`.

**Body**:
```json
{
  "contract_id": "<uuid>",
  "signer_email": "maria@example.com",
  "signed_doc_url": "https://drive.google.com/...",
  "signature_hash": "(opcional, si se usa firma criptografica)",
  "status": "signed"
}
```

UPDATE `contracts` con COALESCE para no pisar valores existentes. Touch trigger pone signed_at automaticamente. Logs en activity_log.

## Flujo tipico

```bash
# 1. Damian genera el encargo profesional al firmar visita inicial
curl -X POST .../webhook/contract-generate -H "X-API-Key: ..." -d '{
  "project_id": "<uuid>",
  "contract_type": "encargo_profesional",
  "parties": [...],
  "scope": "...",
  "amount_eur": 4800,
  "expires_days": 60
}'
# -> 201 con doc_url

# 2. Damian abre el Google Doc, revisa, ajusta si hace falta
# 3. Damian descarga PDF y lo envia al cliente (manualmente)
# 4. Cliente firma (manualmente, en papel o con FNMT/Autofirma)
# 5. Damian recibe firmado, lo sube a Drive, marca:
curl -X POST .../webhook/contract-signed -H "X-API-Key: ..." -d '{
  "contract_id": "<uuid>",
  "signer_email": "cliente@...",
  "signed_doc_url": "https://drive.google.com/file/d/..."
}'
# -> 200 status='signed'
```

## Queries utiles

```sql
-- Contratos pendientes de firma
SELECT id, contract_type, title, status, sent_at,
       (now() - sent_at)::interval AS waiting,
       expires_at, (expires_at - now())::interval AS time_left
FROM contracts WHERE status IN ('sent','ready_to_sign')
ORDER BY expires_at ASC;

-- Contratos por proyecto
SELECT contract_type, status, signed_at, amount_eur, doc_url
FROM contracts WHERE project_id = '<uuid>'
ORDER BY generated_at DESC;

-- Contratos firmados ultimos 90d
SELECT contract_type, count(*), sum(amount_eur) FROM contracts
WHERE status='signed' AND signed_at > now() - INTERVAL '90 days'
GROUP BY 1 ORDER BY 2 DESC;
```

## Proximas iteraciones

1. **Plantillas en BD** (`contract_templates`): permitir editar plantillas sin tocar workflow.
2. **Integracion DocuSign / FNMT / Autofirma**: enviar PDF a firma electronica desde el workflow, recibir webhook con firma + hash.
3. **`cron_contract_followup`**: alerta diaria de contratos `sent` con > 7d sin firmar.
4. **Generacion PDF**: Google Doc -> PDF automatico tras Damian aprueba el draft.
5. **Validacion DNI**: validate format en `parties` (solo formato, no AEAT).
6. **Hook con `agent_proposal`**: tras propuesta aprobada, auto-generar `encargo_profesional` o `contrato_cliente`.
7. **Hook con `qc_recepcion_provisional` complete**: auto-generar `acta_recepcion_provisional`.

## Espacio para Damian

```
## Personalizaciones de mis plantillas

- Encargo profesional: anyado clausula X sobre Y
- Contrato gremio: ITA + altas SS + plan PRL especifico (siempre)
- ...

## Servicio de firma electronica usado actualmente

- ...
```
