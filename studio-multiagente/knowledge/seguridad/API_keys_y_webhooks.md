# API Key + tokens en webhooks expuestos

## Estado

- **Migración 007** aplicada: tabla `system_config` con `webhook_api_key`.
- **Credencial n8n**: `Webhook API Key (entrante)` (id `Ba643jvuElTgMawr`, tipo `httpHeaderAuth`).
- **Última revisión**: 2026-04-25.

## Webhooks expuestos a internet — autenticación

Todos los webhooks siguientes requieren cabecera `X-API-Key: <valor de system_config.webhook_api_key>`. n8n los rechaza automáticamente con 401 si la cabecera falta o no coincide.

| Webhook | Workflow | URL pública |
|---|---|---|
| `/webhook/new-project` | `init_new_project` (`HzPLldZVJGFjKbuc`) | https://n8n-n8n.zzeluw.easypanel.host/webhook/new-project |
| `/webhook/orchestrator` | `main_orchestrator` (`EF5lPbSNlmA3Upt1`) | https://n8n-n8n.zzeluw.easypanel.host/webhook/orchestrator |
| `/webhook/trigger-audits-cron` | `cron_post_phase_audits` (`UyfJNFuf17w2BmFU`) | https://n8n-n8n.zzeluw.easypanel.host/webhook/trigger-audits-cron |

**Sin auth (riesgo bajo, single-user)**:
- `/webhook/architect-presence` (`util_architect_presence`): cambia el flag online/offline. Solo modifica un boolean. Damián lo usa desde browser bookmark — añadir auth obligaría a tener token en URL. Pendiente para V2 multi-tenant.

## Cómo obtener la API key

Ya está en `system_config`:

```sql
SELECT value FROM system_config WHERE key = 'webhook_api_key';
```

O en n8n: Credentials → "Webhook API Key (entrante)" → ver el valor.

## Cómo invocar webhooks desde fuera

```bash
curl -X POST https://n8n-n8n.zzeluw.easypanel.host/webhook/new-project \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <WEBHOOK_API_KEY>" \
  -d '{ "client_name": "...", "project_name": "...", "project_type": "reforma_integral", ... }'
```

Si la cabecera falta o no coincide → 401.

## Llamadas internas n8n→n8n

Cuando un workflow llama a otro vía HTTP Request (no `Execute Sub-workflow`), también necesita el header. El nodo `Trigger Orchestrator` en `init_new_project` usa `authentication: predefinedCredentialType` con la credencial `Webhook API Key (entrante)` para añadir el header automáticamente.

`Execute Sub-workflow` (n8n→n8n internamente) **no requiere** API key — es comunicación directa intra-n8n, no pasa por HTTP público.

## Tokens en email approval

Cuando un agente envía un email con botones "Aprobar/Rechazar/Seleccionar" (`agent_briefing`, `agent_design`, `agent_proposal`), cada URL incluye un parámetro `&token=<webhook_token>` único de la aprobación. El agente valida tras el `Wait` resume:

```javascript
// patrón aplicado en Process Approval Response / Process Selection / Parse Decision
const expectedToken = approvalRecord.webhook_token;
const receivedToken = $input.first().json.query.token;
const tokenValid = !!expectedToken && receivedToken === expectedToken;
if (!tokenValid) {
  // forzar rejection
  action = 'reject';
}
```

**Almacenamiento de tokens**:
- `approvals.webhook_token` (existía ya, ahora se usa). Generado por `gen_random_uuid()` en INSERT.
- `proposals.webhook_token` (nueva columna añadida en migración 007).

**Vida útil del token**: dura lo que dure el Wait node (típicamente 72h por TTL de la approval). Si el arquitecto no actúa antes, el token caduca con la approval (`expires_at`).

## Rotación de la API key

Para rotar la key (recomendado al menos cada 6 meses, o tras cualquier sospecha de filtración):

```sql
UPDATE system_config
SET value = 'arquitai-' || encode(gen_random_bytes(24), 'base64'),
    updated_at = NOW()
WHERE key = 'webhook_api_key';
```

Después actualizar la credencial `Webhook API Key (entrante)` en n8n con el nuevo valor (UI → Credentials → editar → guardar). **Importante**: tras la rotación, cualquier sistema externo que llame a webhooks dejará de funcionar hasta que actualice su header.

## Alertas pendientes

- **Rate limiting**: hoy no existe. Un atacante con la API key puede hacer 1000 requests/segundo. Pendiente para próxima iteración: contador en BD + bloqueo si > N en X minutos.
- **IP allow-list**: hoy abierto a cualquier IP. Pendiente para V2: tabla `allowed_ips` consultada en cada webhook.

## Espacio para Damián

```
## Sistemas externos que llaman a webhooks de ArquitAI

- Sistema X (qué hace, qué webhook usa, fecha rotación key): ...
- ...
```

Documentar aquí cualquier integración externa permite saber qué romper al rotar.
