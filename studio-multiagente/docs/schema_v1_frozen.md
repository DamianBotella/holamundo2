# Schema v1 — FROZEN — contrato para construir la interfaz Foxhole

**Fecha de freeze**: 2026-04-29 (B28)
**Versión**: v1
**Estado verificado**: 45 migrations aplicadas (003-046), auditadas 2026-04-29.

---

## Política de cambios desde aquí

A partir de este freeze, **el schema NO cambia sin migration con número incremental** y registro en tabla `applied_migrations` (ver migration 046).

Cualquier cambio = nueva migration + INSERT en `applied_migrations` con `filename` y `notes`. El script `scripts/check_migration_drift.py --check` debe pasar OK antes de cada deploy.

La interfaz Foxhole se construirá contra este contrato. Si una columna se renombra, la UI rompe — por eso desde aquí hay que ser estrictos.

---

## Tablas core (44 confirmadas en producción)

### Pipeline core (proyecto + agentes)
- `projects` — entidad central. Tiene `current_phase` (gobierna orquestador), `briefing_hash`, `metadata` jsonb, `tenant_id`.
- `clients` — clientes finales. Tiene PII encriptada en `email_enc`, `phone_enc`, `notes_enc`. NO usa columnas plain `email`/`phone` (dropped en migration 034).
- `briefings` — output de `agent_briefing`. `execution_id` link a `agent_executions`.
- `design_options` — output de `agent_design`. `execution_id` link.
- `regulatory_tasks` — output de `agent_regulatory`. Tiene `normativa_confidence`, `citation_source`, `normativa_fetched_at`.
- `materials` — output de `agent_materials`. `execution_id` link.
- `agent_executions` — log de cada ejecución de agente con `status`, `started_at`, `finished_at`, `cost_usd`, `tokens_in/out`.
- `agent_prompts` — system + user prompts por agente. Tiene `is_active`, `content`, `model_recommended`, `temperature`. **NO tiene `updated_at`** (atención al UPDATE).
- `agent_prompts_history` — versiones históricas (migration 037).
- `approvals` — peticiones de aprobación humana via webhook.
- `activity_log` — log de eventos. Tiene `details jsonb` (migration 045) además de `output_summary`, `phase_at_time`, `status`, `error_message`.
- `project_intelligence` — KV store cross-agente por proyecto.

### Studio profile (multi-tenant ready)
- `studio_profile` — perfil del estudio. 8 secciones jsonb: `identity`, `tone`, `priorities`, `red_lines`, `visit_checklist`, `materials_pref`, `trades_pref`, `jurisdiction`. PK `studio_id`. Tiene `active`, `setup_source` (manual/onboarding_chat/admin_edit/baseline).
- `onboarding_sessions` — sesiones del chat conversacional. `status` (in_progress/completed/abandoned), `messages` jsonb, `sections_covered` jsonb, `resume_token`.
- Función SQL `get_active_studio_profile()` — devuelve la fila active=true más reciente.

### Materiales y precios
- `price_references` — precios verificados de partidas (CYPE/BEDEC).
- `supplier_catalog` — items del catálogo del estudio + 22 items genéricos seed.

### Seguridad y PII
- `safety_plans` — output de `agent_safety_plan`. EBSS/PSS según RD 1627/1997.
- `accessibility_audits` — output de `agent_accessibility`.
- `pathology_findings` — output de `agent_pathology`. **Columnas reales**: `pathology_type`, `severity`, `urgency`, `affects_safety`, `estimated_intervention_cost_min/max`. NO `type`/`cost_min`/`cost_max`.

### Trámites y permisos
- `permit_applications` — solicitudes de licencia (migration 010).
- `permit_status_history` — histórico de estados.
- `qc_checks` — controles de calidad de obra.
- `gdpr_requests` — solicitudes RGPD del cliente.
- `consent_records` — consentimientos GDPR.

### Financiero y contratos
- `invoices` — facturas con `webhook_token` (migration 016).
- `contracts` — contratos generados.
- `contract_templates` — plantillas con placeholders.
- `certificates` — certificados generados (7 tipos).
- `energy_assessments` — evaluaciones eficiencia energética.

### Postventa y operaciones
- `aftercare_incidents` — incidencias postventa LOE.
- `trade_quotes` — RFQs a oficios con `webhook_token`.
- `collaborators` — colaboradores externos del estudio.
- `site_reports` — reportes de visita a obra (Vision LLM).
- `project_notes` — notas internas del estudio.

### Multi-tenant infraestructura
- `tenants` — tenant_id (hoy 1 fila, listo para multi).
- `system_config` — config global key/value (architect_email, encryption_key, webhook_api_key).
- `client_access_tokens` — tokens del cliente para webhooks.

### Seguridad sistema
- `security_events`, `access_log`, `rate_limits`, `ip_blocklist` — capa de seguridad.
- `llm_calls` — tracking centralizado de costes LLM.
- `db_size_history` — histórico tamaño BD (capacidad).
- `system_health_score` + `health_score_history` — salud sistema.

### Knowledge / RAG (preparado para LightRAG futuro)
- `normativa_knowledge` — cache de normativa fetched + `content_hash` (migration 042b family).
- `normativa_sources` — fuentes oficiales tracked.
- pgvector embeddings (migration 006) — soporte para RAG semántico.

### Tracking de migrations (B28)
- `applied_migrations` — filename PK, applied_at, applied_by, sha256, notes.

---

## Funciones SQL críticas (12 confirmadas)

| Función | Propósito | Migration |
|---|---|---|
| `pii_encrypt(text)` / `pii_decrypt(text)` | Encriptar/desencriptar PII | 009, 031 |
| `check_rate_limit(...)` | Rate limiting webhooks | 007 |
| `log_access(...)` | Log de acceso | 007 |
| `raise_security_event(...)` | Alertas seguridad | 007 |
| `is_ip_blocked(text)` / `ban_ip(text, ...)` | IP blocklist | 033 |
| `validate_client_token(text)` | Tokens cliente | 017 |
| `current_tenant_id()` | Multi-tenant | 030 (RLS template) |
| `get_active_studio_profile()` | Studio activo | 042 |
| `touch_studio_profile()` / `touch_onboarding_session()` | Triggers updated_at | 042 |

---

## Reglas duras del contrato

1. **Toda mutación a estas tablas pasa por workflow n8n o función SQL documentada**. La interfaz Foxhole NO escribe directamente — llama a un endpoint API que llama a un workflow.
2. **Nombres de columnas NO se renombran sin alias durante mínimo 1 release**. Si renombras, dejas alias por compatibilidad.
3. **Las jsonb del studio_profile (8 secciones) NO se aplanan a tablas relacionales**. La interfaz lee el jsonb completo y pinta secciones según el shape.
4. **`current_phase` de `projects` es la fuente de verdad del estado del proyecto**. La interfaz nunca infiere fase desde otras tablas — siempre lee este campo.
5. **`activity_log` es el feed cronológico de eventos**. La interfaz lo consume para el "newsfeed" de cada proyecto.
6. **Los workflows que escriben deben usar `execution_id`** para trazabilidad (briefings, design_options, regulatory_tasks, materials lo tienen).
7. **`tenant_id` está presente en todas las tablas con datos sensibles**. Cuando se active RLS (próxima sesión), filtrará automáticamente.

---

## Cómo verificar este contrato

```bash
cd studio-multiagente/scripts
python check_migration_drift.py --check
```

Debe devolver `OK — todas las migrations del repo están aplicadas en BD.`

Si devuelve drift, **NO se construye nada nuevo** hasta resolver.

---

## Próximos cambios planificados (NO aplicados aún, requerirán migration)

Estos cambios SÍ tocarán schema y exigirán nueva migration cuando se ejecuten:

| Cambio | Migration prevista | Sesión |
|---|---|---|
| Activar RLS Postgres real con `current_tenant_id()` filtrando por sesión | 047 | Multi-tenant |
| Supabase Auth: tabla `auth.users` linkada a `tenants` y `studio_profile` | 048 | Auth |
| API contract — vistas read-only para la UI (`v_project_summary`, etc.) | 049 | API REST |
| Posibles ajustes según hallazgos del E2E real | 050+ | E2E |

Cualquier otro cambio fuera de esto requiere conversación previa.
