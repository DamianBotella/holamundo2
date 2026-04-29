# Reality Check — 2026-04-29 (B27)

**Auditor**: agente `Reality Checker` (`agency-agents-main/testing/testing-reality-checker.md`).
**Veredicto inicial**: 🔴 NOT PRODUCTION READY.
**Veredicto tras fixes de esta sesion**: 🟡 NEEDS WORK (ver pendientes al final).

---

## TL;DR

El sistema tenia **el mismo patron de bug que migration 042**: schema drift silencioso. Workflows que parecian funcionar en realidad fallaban en el ultimo paso (logging) y nadie se enteraba. Detectados 2 bugs criticos, ambos arreglados en esta sesion.

---

## Findings BLOQUEANTES detectados

### 🔴 1. `activity_log.details` no existia — 6+ crons rotos
**Sintoma**: 6 workflows activos fallan todos los dias con `column "details" of relation "activity_log" does not exist`. Ejecuciones fallidas verificadas: 1916, 1929, 1943, 1992, etc.

**Crons afectados**:
- `cron_health_check` (`ztTrZupYJiQmkNGW`) — IRONICO: los checks pasan pero el log OK falla. Ciegos a fallos reales.
- `cron_proposal_response_followup` (`YHTfBfLeaSFD7Vma`)
- `cron_backup_verify` (`ERiFhqiHEpcwHEbz`)
- `cron_db_size_check` (`edBWaDXssbrp96X0`)
- `cron_data_integrity` (`XP04imsIGNlr1smJ`)
- `cron_normativa_freshness` (`bMhUwi8PdlIlh5aW`)

**Causa raiz**: schema drift. El schema deployado (mvp_schema.sql:474) tiene columnas `(project_id, agent_name, action, phase_at_time, output_summary, status, error_message)`. **NO existe `details`**. Los crons recientes asumian una columna que nunca se creo.

**Fix aplicado**: ✅ Migration `045_activity_log_details.sql` — `ALTER TABLE activity_log ADD COLUMN details jsonb DEFAULT '{}'::jsonb` + indice GIN. Aplicado en Supabase via workflow MCP temporal. Verificado con INSERT smoke test.

### 🔴 2. `cron_pathology_review` columnas mal referenciadas
**Sintoma**: workflow falla diario 12:00 con `column "type" does not exist`.

**Causa raiz**: el query usa `pf.type`, `pf.cost_min`, `pf.cost_max` pero las columnas reales en `pathology_findings` son `pathology_type`, `estimated_intervention_cost_min`, `estimated_intervention_cost_max`.

**Columnas reales** (verificadas via information_schema):
```
id, project_id, inspection_date, inspector, location_in_property, photo_urls,
description, pathology_type, severity, urgency, structural, affects_safety,
affects_habitability, recommended_action, estimated_intervention_cost_min,
estimated_intervention_cost_max, requires_specialist, specialist_type,
vision_summary, vision_raw, llm_model, llm_tokens_in, llm_tokens_out,
llm_cost, status, alert_sent, notes, created_at, updated_at
```

**Fix aplicado**: ✅ patchNodeField en `Find Issues` con SELECT aliasing `pathology_type AS type`, `estimated_intervention_cost_min AS cost_min`, `estimated_intervention_cost_max AS cost_max`. El JS de Build Email no necesita cambios (sigue accediendo a `f.type`, `f.cost_min`, `f.cost_max`). Verificado con SELECT que devuelve `report` sin error.

---

## Pendientes (no aplicados esta sesion)

### 🔴 BLOQUEANTE — Validar E2E real de los 13 agentes
El Reality Checker NO pudo confirmar que ninguno de los 13 agentes LLM-using haya ejecutado correctamente recientemente. Solo se ejecutaron crons de monitoreo (con bugs). Sin un proyecto stub completo pasando por `main_orchestrator`, no podemos certificar que el pipeline funciona.

**Accion**: en proxima sesion, crear proyecto stub via `init_new_project`, dejar que `main_orchestrator` lo procese, validar via `agent_executions` que cada uno de los 13 agentes completo con status='completed' y output no vacio.

### 🟡 IMPORTANTE — Auditar otros 5 crons que aun pueden tener drift
El Reality Checker solo verifico activity_log. Los otros 5 crons que rompian (`cron_proposal_response_followup`, `cron_backup_verify`, `cron_db_size_check`, `cron_data_integrity`, `cron_normativa_freshness`) usan tambien `details` y ahora deberian funcionar. Verificar en proxima ejecucion programada que efectivamente pasan sin error.

### 🟡 IMPORTANTE — Schema drift recurrente
Patron detectado: migrations creadas en repo pero NO aplicadas en Supabase. Hoy van 3 incidentes (042, 044, 045). Necesitamos un mecanismo para evitarlo:
- Opcion A: tabla `applied_migrations(filename, applied_at, applied_by)` que TODOS los workflows verifican al arrancar.
- Opcion B: cron `cron_migration_check` que compara `schemas/migrations/*.sql` vs estado real de la BD y alerta si hay drift.
- Opcion C: politica explicita "toda migration debe aplicarse en la sesion en que se commitea, sin excepciones".

### 🟡 IMPORTANTE — n8n version lag
Instancia en 2.47.13. Latest 2.49.0. No bloqueante pero acumula riesgo.

### 🟢 NICE TO HAVE — Workflows abandonados
Hay 100+ workflows activos. Hipotesis: algunos no se ejecutan desde hace 30+ dias y son ruido. Auditoria pendiente con histograma de ejecuciones por workflow.

---

## Things that ACTUALLY work (verificado)

- Studio profile infrastructure (migration 042 deployed correctly desde B25). `get_active_studio_profile()` retorna 1 fila.
- agent_regulatory topologia post-migration 044. Load Studio Profile cableado correcto.
- util_llm_call, init_new_project, main_orchestrator activos sin errores observados.
- Conexion Postgres OK desde n8n.
- pii_encrypt/decrypt roundtrip funciona.

---

## Recomendaciones para la siguiente sesion (orden estricto)

1. **E2E real** del pipeline con proyecto stub. Hasta tener evidencia de los 13 agentes funcionando, no se puede certificar el sistema para venta.
2. Verificar que las proximas ejecuciones programadas de los 6 crons afectados pasan limpio (mañana 06:00 cron_health_check, etc.).
3. Decidir e implementar mecanismo anti-drift de migrations (opcion A, B o C).
4. Auditoria de workflows abandonados (cron + reporte).

**Bottom line**: salimos de NOT PRODUCTION READY a NEEDS WORK. Falta E2E real para llegar a READY.
