# ArquitAI — Studio Multiagente

Sistema multiagente para el estudio de arquitectura técnica de Damián Martínez. Procesa proyectos de reforma desde captación hasta postventa con 22 agentes IA coordinados, persistencia en Supabase y orquestación n8n.

## Estado actual (2026-04-26)

**MVP de los 11 agentes core construido + 11 agentes complementarios + capa de seguridad/observabilidad/UX completa**.

- 90+ workflows activos en n8n
- 36 migraciones SQL aplicadas
- 14 crons de housekeeping (security, integrity, costs, backup, db_size)
- 5 dashboards web HTML (admin index, estudio, security, LLM costs, project view)
- PII totalmente cifrada (pgcrypto + pii_encrypt/pii_decrypt)
- IP blocklist con auto-ban
- Honeypot con 9 paths trampa
- Health check diario que email-alerta si infra rompe

## Punto de entrada — abrir el navegador en

```
GET https://n8n-n8n.zzeluw.easypanel.host/webhook/admin-index
Header: X-API-Key: <WEBHOOK_API_KEY>
```

Desde ahí navegas a:
- `/webhook/dashboard-html` — KPIs del estudio (proyectos, finance, concierge)
- `/webhook/security-dashboard-html` — eventos, blocklist, top IPs
- `/webhook/llm-costs-html` — coste por agente / proyecto / modelo
- `/webhook/admin-tokens` — vista read-only de tokens cliente
- `/webhook/admin-project?project_id=<uuid>` — drill-down de un proyecto
- `/webhook/admin-export?dataset=<projects|invoices|tokens|aftercare|contracts|llm_calls>` — CSV download

## Estructura del repo

```
studio-multiagente/
├── ArquitAI.md                  ← Documento maestro del producto
├── CLAUDE.md                    ← Contexto para Claude Code
├── README.md                    ← (este archivo)
├── docs/
│   ├── arquitectura.md          ← Arquitectura general n8n 2.12.x
│   ├── modelo_datos.md          ← Modelo de datos
│   ├── mapa_workflows.md        ← Mapa de workflows
│   ├── agentes.md               ← Implementación por agente
│   ├── plan_fases.md            ← MVP → V2 → V3
│   ├── handoff_resumen.md       ← Estado actual
│   └── contexto_para_damian.md  ← 20 oportunidades + estructura knowledge/
├── knowledge/
│   ├── agents/README.md         ← Referencia rápida de los 22 agentes
│   ├── seguridad/
│   │   ├── hardening_fase2.md   ← Documento maestro de seguridad
│   │   └── referencia_workflows.md ← Mapa de workflows + funciones SQL
│   └── (otros knowledge files)
├── schemas/
│   ├── mvp_schema.sql           ← Schema SQL completo
│   └── migrations/              ← 36 migraciones aplicadas (008..036)
├── prompts/
│   └── agent_prompts.md         ← Prompts versionados (también en BD agent_prompts)
├── workflows/
│   └── *.json                   ← 90+ workflows JSON importables
└── references/
    └── n8n_node_types.md
```

## Stack

- **n8n 2.12.x** self-hosted (Docker) — orquestación
- **Supabase PostgreSQL 15+** con extensions pgcrypto + uuid-ossp — persistencia + cifrado
- **OpenAI / Anthropic** — LLMs vía `util_llm_call`
- **Google Drive + Gmail** — almacenamiento + notificaciones
- **DocuSign / Signaturit** (futuro) — firma electrónica con HMAC verify

## Capa de seguridad (resumen)

| Capa | Implementación |
|---|---|
| Auditoría | `access_log` + `security_events` + `activity_log` |
| Detección | `util_security_check` (rate limit + 6 patterns + ip_blocklist) en 4 endpoints públicos |
| Auto-ban | 3+ honeypots/10min OR 5+ patterns/10min → ban 24h |
| Cifrado PII | `pii_encrypt/pii_decrypt` con clave en `system_config`. Columnas plain dropeadas (migración 034) |
| Rate limit | Sliding window minuto+hora por (ip, endpoint) |
| Health check | Diario 06:00 — funciones SQL + tablas + roundtrip |
| Pen-test lite | Semanal Dom 04:00 — 14 tests E2E |
| HMAC | `util_hmac_verify` (pgcrypto-based) listo para webhooks externos |
| Honeypot | 9 paths trampa con auto-ban escalado |
| DB size | Diario 04:45 — alerta si crecimiento >50% en 7d |
| Backup | Diario 07:00 — alerta si último backup >7d o falló |

Detalle completo: `knowledge/seguridad/hardening_fase2.md`.

## Capa de housekeeping (14 crons)

**Diarios**: blocklist_cleanup (04:00), events_auto_resolve (02:30), access_log_purge (04:30), inactive_token_cleanup (03:30), db_size_check (04:45), backup_verify (07:00), data_integrity (05:30), health_check (06:00), stuck_executions (cada hora :15)

**Semanales**: security_pentest_lite (Dom 04:00), security_dashboard_alert (Lun 08:30), security_events_purge (Dom 03:00), project_review (cada 6h), qc_review, weekly_summary (Dom)

**Mensual**: key_rotation_reminder (día 1 09:00)

Listado completo + IDs: `knowledge/seguridad/referencia_workflows.md`.

## Setup en un PC nuevo (clonado fresco)

1. **Clone**:
   ```bash
   git clone https://github.com/DamianBotella/holamundo2.git
   cd holamundo2
   ```

2. **Recrear `.mcp.json`** (excluido del repo por contener credenciales):
   ```bash
   cp .mcp.example.json .mcp.json
   # Edita .mcp.json y reemplaza:
   #   <TU_INSTANCIA_N8N>     -> https://n8n-n8n.zzeluw.easypanel.host
   #   <TU_N8N_API_KEY>       -> tu API key de n8n (Settings -> n8n API)
   ```

3. **Restaurar memoria de Claude** (snapshot en `studio-multiagente/.claude-memory-snapshot/`):
   - Windows: ver instrucciones en `studio-multiagente/.claude-memory-snapshot/README.md`
   - macOS/Linux: idem
   - El snapshot contiene `MEMORY.md` + 6 archivos temáticos (project_context, project_state, feedbacks, etc.).

4. **Abrir Claude Code en el proyecto**:
   - VSCode: abrir la carpeta del repo, Claude Code carga automáticamente `CLAUDE.md` + el `.mcp.json` con sus credenciales.
   - El servidor n8n-mcp se levanta automáticamente con el comando `n8n-mcp` (instalar globalmente con `npm install -g n8n-mcp` si no está).

5. **Verificar conexión a n8n**:
   ```javascript
   // En el chat de Claude:
   mcp__n8n__n8n_health_check
   ```
   Debe responder `{ status: "ok" }`.

## Quickstart para una nueva sesión

1. Abrir admin index en navegador → ver KPIs.
2. Si rojo en algún card → leer `knowledge/seguridad/hardening_fase2.md` sección correspondiente.
3. Para añadir/modificar un agente: leer `knowledge/agents/README.md` → identificar agent → MCP `mcp__n8n__n8n_get_workflow` para inspeccionar → patchear con `n8n_update_partial_workflow`.
4. Para añadir migration: incrementar número (próxima = 037), aplicar via workflow temporal, sincronizar el `.sql` local.
5. Cualquier workflow nuevo: setear `errorWorkflow: "qfQWaGSpyjgdeFt5"` (error_handler).

## Filosofía operacional

- **Nada bloqueante**: agentes proponen, arquitecto aprueba.
- **Audit by default**: cada acción importante deja rastro en activity_log o security_events.
- **Cifrado por defecto**: cualquier PII pasa por `pii_encrypt()`.
- **Costos visibles**: `util_llm_call` registra cada llamada en `llm_calls` (coste/proyecto/agente trazable).
- **Rate limit por endpoint**: límites ajustados por tipo de endpoint (gdpr 5/min más estricto que client-ask 10/min).
- **Auto-ban antes que email**: scanners caen automático, Damián no se entera (a menos que `data_breach_suspected` critical).
- **Single tenant ahora, RLS template listo**: cuando llegue el 2º estudio, activar las policies definidas en migration 030.

## Mantenimiento día a día

- Damián abre `/webhook/admin-index` cada mañana.
- Si todo verde → no hay que tocar nada.
- Si critical_unresolved > 0 → click `/webhook/security-dashboard-html` para investigar.
- Si errores 24h > 0 → `n8n_executions` filter status=error.
- Si IP blocked > 0 → revisar si fue scanner real (el cron expira 24h auto).

## Historial

Ver `git log --oneline` para historial completo. Bloques cerrados:
- Fase 1-2: hardening seguridad (auditoría + cifrado + auto-ban)
- Fase 3: robustez operacional (stuck_executions + data_integrity + LLM tracking + error categorization)
- Fase 4: UX navegable (admin index + project view + CSV export + tokens view + DB size + backup verify)
