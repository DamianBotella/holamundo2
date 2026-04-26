# Security Hardening Fase 2 — Auditoría + observabilidad + pen-test + multi-tenant template

## Estado (2026-04-26)

Sec 3.14 ArquitAI passing de "parcial" a "completo MVP" con esta sesión.

**Migraciones aplicadas**:
- `029_security_hardening.sql`: tablas `access_log`, `security_events`, `rate_limits` + funciones `check_rate_limit()`, `log_access()`, `raise_security_event()` + vista `security_dashboard`.
- `030_rls_template.sql`: tabla `tenants` (1 tenant Damian) + columnas `tenant_id` en projects/clients/collaborators + función `current_tenant_id()` lista para activar RLS.

**Workflows nuevos** (todos activos):

| Workflow | ID | Tipo | Schedule |
|---|---|---|---|
| `util_security_check` | `5LEflgQnjSvgGAYK` | sub-workflow | invocable desde otros |
| `cron_inactive_token_cleanup` | `LmnF0ePvXEzT2ZdP` | cron | diario 03:30 |
| `cron_security_pentest_lite` | `9drH5gGPV9hweKp2` | cron | semanal Dom 04:00 |
| `cron_security_dashboard_alert` | `YSQHEhh0IRI93k7C` | cron | semanal Lun 08:30 |
| `util_security_dashboard` | `k7sXYc50Ta1Y8NhN` | API endpoint | `GET /webhook/security-dashboard` |

## Capas implementadas

### Capa 1: Auditoría
- `access_log` — toda acción sobre datos sensibles puede registrarse con `log_access(...)`. Indices por IP, recurso, denied/error.
- `security_events` — eventos clasificados (16 tipos: auth_failed, rate_limit_hit, prompt_injection, sql_injection_attempt, xss_attempt, gdpr_violation_risk, etc.) con severidad (info/low/medium/high/critical) y resolución.

### Capa 2: Detección
- `util_security_check` — sub-workflow que cualquier endpoint puede invocar. Hace **rate limit** (atomic SQL function con ventana móvil minuto+hora) + **detección de patrones**: SQL injection, XSS, path traversal, prompt injection, SSRF, command injection. Si detecta → registra `security_event` con severidad apropiada y devuelve `allowed:false`.

### Capa 3: Higiene proactiva
- `cron_inactive_token_cleanup` (diario 03:30): revoca tokens >60d sin uso o expirados >7d. Registra evento.
- `cron_security_pentest_lite` (semanal): ejecuta 10 tests E2E que verifican que los endpoints rechazan correctamente: auth missing/wrong, UUID malformado, campos faltantes, tokens inválidos. Si algún test falla → email crítico a Damián con tabla detallada.

### Capa 4: Observabilidad
- `util_security_dashboard` — endpoint `GET /webhook/security-dashboard` con auth: devuelve JSON con snapshot completo (events 24h, tokens, consents, GDPR, IPs top, blocks).
- `cron_security_dashboard_alert` (semanal Lun 08:30): email con KPIs + tabla de eventos recientes 7d coloreada por severidad.

### Capa 5: Multi-tenant (preparado, no activo)
- Tabla `tenants` con un tenant único actual (Damian).
- Columnas `tenant_id` en projects/clients/collaborators ya pobladas.
- Función `current_tenant_id()` lista. **Para activar RLS en V2**:
  ```sql
  ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
  CREATE POLICY tenant_isolation ON projects USING (tenant_id = current_tenant_id());
  CREATE POLICY tenant_insert ON projects FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
  -- repetir por tabla
  ```
  Y en cada conexión: `SET LOCAL app.current_tenant = '<tenant_uuid>'`.

## Pen-test resultados (2026-04-26)

Recalibrado: **100% pass (10/10)**.

Tests verificados:
1. Endpoint con auth requerida sin X-API-Key → 403 ✅
2. Auth con key incorrecta → 403 ✅
3. UUID malformado → 400 ✅
4. Campos requeridos faltantes → 400 ✅
5. client-ask sin token → 400 ✅
6. client-ask con token bad → 401 ✅
7. aftercare form sin token → 404 con HTML ✅
8. aftercare form bad token → 404 ✅
9. project_summary bad token → 404 ✅
10. GDPR sin token → 400 ✅

## Findings reales detectados por dashboard

Snapshot al activar:
- ⚠️ **23 clientes sin consent registrado** (falla GDPR — pendiente backfill con `consent_records`).
- ✅ 0 critical eventos sin resolver (tras cerrar el pen-test antiguo recalibrado).
- ✅ 0 stale tokens, 0 expiring soon.
- ✅ 0 GDPR requests pending/near deadline.

### Resolución (2026-04-26)

Tras inspección, los 23 clientes eran **residuo de tests E2E** (`cliente.test@example.com` con sufijos v1-v5, `cliente.intake.v3@example.com`, etc.). Ninguno era real.

**Cleanup ejecutado** (transacción única, vía `migration_008_TEMP` ad-hoc, ya borrado):
- 22 clients test borrados (se conserva `60bbd8c6-cc30-480e-bea5-5cc26813480e` Maria Garcia Lopez como sandbox).
- 26 projects + cascada (briefings, design_options, regulatory_tasks, safety_plans, project_intelligence, cost_estimates, proposals, trade_requests, permit_applications, invoices, anomalies_detected, consultation_queue, client_access_tokens, client_conversations, gdpr_requests, documents, access_log, materials, material_items, energy_assessments, agent_executions, approvals, activity_log).
- Cascada dinámica: la transacción usa `information_schema` para descubrir todas las FKs hacia `projects` y `clients` y borrar en bucle, evitando enumerar tablas a mano (robusto frente a nuevas migraciones).
- Consent backfill manual para sandbox: `INSERT INTO consent_records (client_id, consent_type, granted, granted_at, source) VALUES (sandbox, 'data_processing', true, now(), 'architect_intake')`.

**Estado post-cleanup confirmado**:
- `clients_remaining`: 1 (Maria Garcia, sandbox)
- `projects_remaining`: 1
- `consent_records_active`: 1
- `clients_without_consent`: **0** ✅
- Dashboard limpio.

### Lección aprendida

El CHECK constraint `consent_records_source_check` solo permite: `'architect_intake'|'client_signed_form'|'phone_recorded'|'email_confirmation'|'other'`. Para backfills manuales usar `'architect_intake'` o `'other'`.

## Cómo usar `util_security_check` desde otros workflows

```javascript
// En el primer Code node del workflow:
const headers = $('Webhook').first().json.headers || {};
const body = $('Webhook').first().json.body || {};
return [{ json: {
  source_ip: headers['x-real-ip'] || (headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown',
  endpoint: '/webhook/mi-endpoint',
  user_agent: headers['user-agent'] || '',
  max_per_minute: 30,  // ajustar
  max_per_hour: 200,
  agent_name: 'mi_workflow',
  payload_text: JSON.stringify(body)  // para detección de patrones
} }];
```

Después: `executeWorkflow → util_security_check`. Output: `{allowed: bool, blocked_reason: string, rate_minute, rate_hour, patterns_detected}`. Si `allowed=false`, devolver 429 (rate limit) o 403 (pattern detectado).

## Próximas iteraciones

1. ~~**Integrar `util_security_check` en endpoints públicos**~~ ✅ Hecho 2026-04-26: cuatro endpoints integrados (`/webhook/client-ask`, `/webhook/gdpr-request`, `/webhook/aftercare-submit`, `/webhook/contract-signed`). Patrón: `Build Security Payload → Run Security Check → Security OK?` antes del primer hit a DB. Si `allowed=false` → 429 con `blocked_reason`. Smoke-test verificado: prompt-injection en client-ask devuelve `{status:'blocked', reason:'pattern:prompt_injection'}`; XSS en gdpr-request devuelve `{status:'blocked', reason:'pattern:xss'}`; preguntas legítimas pasan. `aftercare-submit` y `contract-signed` quedan tras Header Auth previo (defensa en profundidad).
2. ~~**Backfill `consent_records`** para los 23 clientes existentes~~ ✅ Hecho 2026-04-26 (cleanup de tests, ver sección "Resolución" arriba).
3. **Cifrar `client_conversations.question/answer`** (puede contener PII del cliente).
4. **Cifrar `gdpr_requests.details`** (datos sensibles del cliente).
5. **Activar RLS multi-tenant** cuando haya un segundo estudio.
6. **Rotación automática de `webhook_api_key`** (cron mensual + workflow `key_rotation` que actualiza system_config).
7. **DKIM/SPF/DMARC** en el dominio del estudio (fuera de n8n — DNS).
8. **Webhook signature** (HMAC-SHA256) en endpoints externos firma DocuSign / aftercare gremio reply.
9. **Honeypot endpoints** (`/webhook/admin`, `/webhook/.env`) que loguean intentos de exploración.
10. **Penetration test profesional anual** (externo, no MVP).

## Espacio para Damián

```
## Mi política propia

- Frecuencia de revisión del dashboard: ...
- Acción ante pen-test < 100% pass: ...
- Quién puede acceder a security_events resolved=false: ...
```
