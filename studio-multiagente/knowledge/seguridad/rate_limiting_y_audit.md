# Rate limiting + audit log enriquecido

## Estado

- **Migración 008** aplicada (pgcrypto, pii_encrypt/decrypt, rate_limit_log, system_backups, activity_log.source_ip/user_agent).
- **Función SQL `check_rate_limit(p_ip, p_endpoint, p_max_per_minute)`** activa.
- **Sub-workflow `util_webhook_security`** (`EipFM8h08uTX1mBn`) en producción.
- **Última revisión**: 2026-04-25.

## Webhooks protegidos

Todos los webhooks expuestos a internet pasan por `util_webhook_security` antes de continuar el flujo. El sub-workflow:

1. Extrae `source_ip` (de `x-real-ip` o `x-forwarded-for`) y `user-agent` de los headers HTTP.
2. Llama a `SELECT check_rate_limit($ip, $endpoint, $max)` — incrementa el contador del minuto actual.
3. Inserta una fila en `activity_log` con `action='webhook_received'`, `status='success'`, `source_ip`, `user_agent`, e `input_summary='endpoint=... rate_limit_max=...'`.
4. Devuelve `{ allowed: bool, blocked: bool, verdict, log_id }`.

| Webhook | max/min | Comportamiento si bloqueado |
|---|---:|---|
| `/webhook/new-project` | 30 | Devuelve HTTP 429 con `{error: 'rate_limit_exceeded'}` |
| `/webhook/orchestrator` | 60 | Descarta silenciosamente vía `Drop Blocked` (responseMode=onReceived ya devolvió 200) |
| `/webhook/trigger-audits-cron` | 10 | Descarta silenciosamente |

La diferencia de comportamiento es intencional:

- **new-project** es síncrono (`responseMode: 'responseNode'`), así que devolvemos un status real al cliente.
- **orchestrator + trigger-audits-cron** son asíncronos (`responseMode: 'onReceived'`), n8n ya devolvió 200 antes de la verificación. Si el atacante satura, ve siempre 200 pero no se ejecuta nada — no le damos feedback útil.

## Cómo añadir el wrapper a un webhook nuevo

1. Crear nodo `Prepare Security Input` (Code) que devuelva `{ source_ip, user_agent, endpoint, max_per_minute, agent_name, project_id? }` leyendo los headers del Webhook.
2. Crear nodo `Webhook Security` (executeWorkflow → `EipFM8h08uTX1mBn`).
3. Crear nodo `Security Allowed?` (IF: `{{ $json.allowed }}`).
4. **Si el webhook es síncrono** (`responseMode: 'responseNode'`): rama `false` → `RespondToWebhook` con statusCode 429.
5. **Si el webhook es asíncrono** (`responseMode: 'onReceived'`): rama `false` → `noOp` (Drop Blocked).
6. Rama `true` → si el flujo aguas abajo lee `$json.body.X`, añadir un nodo `Restore Webhook Payload` (Code) antes que devuelva `$('NombreDelWebhook').first().json`.

Patrón implementado en: `init_new_project`, `main_orchestrator`, `cron_post_phase_audits`.

## Consultar el audit log

```sql
SELECT created_at, agent_name, action, source_ip, user_agent, input_summary
FROM activity_log
WHERE action = 'webhook_received'
ORDER BY created_at DESC
LIMIT 50;
```

Para detectar abusos, agrupar por IP en la última hora:

```sql
SELECT source_ip, count(*) AS hits, array_agg(DISTINCT input_summary) AS endpoints
FROM activity_log
WHERE action = 'webhook_received'
  AND created_at > now() - INTERVAL '1 hour'
GROUP BY source_ip
ORDER BY hits DESC;
```

## Consultar el estado del rate limiter

```sql
-- Ventanas activas en el último minuto
SELECT source_ip, endpoint, request_count, blocked, window_start
FROM rate_limit_log
WHERE window_start > now() - INTERVAL '5 minutes'
ORDER BY request_count DESC;

-- IPs bloqueadas hoy
SELECT source_ip, endpoint, max(request_count) AS peak, count(*) AS minutes_blocked
FROM rate_limit_log
WHERE blocked = true
  AND window_start > current_date
GROUP BY source_ip, endpoint;
```

## Cifrado PII (pgcrypto)

Las funciones `pii_encrypt(text)` y `pii_decrypt(bytea)` usan `pgp_sym_*` con la clave en `system_config.encryption_key`. Pendiente: aplicarlas a las columnas sensibles (`clients.email`, `clients.phone`, `briefings.client_needs`).

Ejemplo de uso:

```sql
-- Almacenar
UPDATE clients SET email_enc = pii_encrypt(email) WHERE id = '...';
-- Leer
SELECT pii_decrypt(email_enc) FROM clients WHERE id = '...';
```

**Pendiente**: migración para añadir columnas `*_enc` (bytea) y migrar datos existentes; vista o helper que descifre transparentemente para los workflows que ya leen `email`/`phone`.

## Próximas iteraciones

1. **Cifrado real de columnas PII** (clients.email/phone, briefings.client_needs) usando `pii_encrypt`. Requiere migración + adaptación de SELECT en agentes.
2. **Sanitización prompt-injection** en `util_llm_call`: regex que detecte patrones tipo "ignore previous instructions" en `prompt_user` y los marque/abortando ejecución.
3. **Backup externo cron** (`cron_external_backup`): pg_dump diario a Google Drive vía credencial existente `Google Drive`. Registra en `system_backups`.
4. **Alerta Damián**: si una IP supera el umbral en >3 minutos consecutivos, enviar email vía `util_notification`.

## Espacio para Damián

```
## Notas operativas

- Cuándo bloqueé manualmente alguna IP: ...
- Última auditoría manual del audit log: ...
- IPs en allow-list (cuando se implemente): ...
```
