# PA-4 — Plan ejecutable: advisory lock en orchestrator (race condition)

**Fecha plan:** 2026-05-03 (B45, sesión autónoma)
**Estado:** documentado, **NO aplicado** (requiere migración SQL nueva 054 + decisión Damián)
**Esfuerzo estimado:** 30 min aplicar, 1h validar.

---

## 1. Estado actual (confirmado en prod)

`Load Project` usa SELECT simple sin lock. Webhooks simultáneos al `/orchestrator` con el mismo `project_id` ejecutan 2× el mismo agente.

**Probabilidad real hoy (single-tenant, Damián):** baja, pero no nula. Se manifestaría si:
- Damián hace re-try manual rápido del orchestrator.
- Cron y webhook disparan a la vez.
- Cliente con problema de red duplica POST.
- Post-X3 multi-tenant: alta.

---

## 2. Por qué `pg_try_advisory_xact_lock` no funciona aquí

n8n ejecuta cada nodo Postgres en su propia conexión/transacción. El lock liberado al final de la transacción del nodo `Load Project` se libera **antes** de llegar a `Run agent_X`. Inútil contra race conditions multi-nodo.

Alternativas viables:

| Alternativa | Complejidad | Reversibilidad |
|---|---|---|
| Lock table explícita (DELETE manual al final) | Media | Alta |
| `pg_advisory_lock` (sesión) + manual unlock | Alta | Baja (riesgo locks colgados) |
| Cambiar Load Project a Code que ejecute todo en una transacción | Alta | Media |
| Idempotency check (no lock, sino "ya hay execution corriendo") | Baja | Alta |

**Recomendación: lock table explícita.** Es lo más simple, debugeable y reversible.

---

## 3. Diseño: lock table explícita

### 3.1 Migración 054_orchestrator_locks.sql.draft

```sql
-- ============================================================
-- Migration 054: orchestrator_locks (race condition fix)
-- Fecha: 2026-05-03 (PA-4 audit X2)
-- ============================================================
-- Por qué: el main_orchestrator no protege contra invocaciones
-- simultáneas. Dos POST /orchestrator para el mismo project_id
-- en <1s ejecutan 2× el mismo agente (briefing duplicado, etc.).
-- Probabilidad baja en single-tenant pero crítica post-X3.
-- ============================================================

CREATE TABLE IF NOT EXISTS orchestrator_locks (
  project_id   uuid PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  locked_at    timestamptz NOT NULL DEFAULT now(),
  execution_id text,
  agent_running text
);

-- TTL automático: locks de más de 10 min se consideran zombies
CREATE INDEX IF NOT EXISTS idx_orchestrator_locks_locked_at
  ON orchestrator_locks (locked_at);

-- Función helper para limpiar zombies (llamada por un cron o por el propio acquire)
CREATE OR REPLACE FUNCTION cleanup_orchestrator_zombies()
RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM orchestrator_locks
  WHERE locked_at < now() - INTERVAL '10 minutes';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Verificación:
-- SELECT * FROM orchestrator_locks;
-- SELECT cleanup_orchestrator_zombies();
```

### 3.2 Cambios en main_orchestrator (3 nodos nuevos + modificar 1)

```
[Load Project]  (modificado: añadir cleanup zombies + try_acquire)
   ↓
[Lock Acquired?]  (NUEVO IF, true → seguir, false → Respond Lock Conflict)
   ├── true  → Project Active? → ... → Run agent_X → ... → Release Lock → Respond final
   └── false → Respond Lock Conflict (NUEVO)
```

Y al final de cada rama exitosa: `Release Lock` (NUEVO postgres) que hace `DELETE FROM orchestrator_locks WHERE project_id = $1`.

### 3.3 SQL específico para Load Project (modificado)

Reemplazar el SELECT actual por:

```sql
-- Limpiar zombies (>10min)
SELECT cleanup_orchestrator_zombies();

-- Intentar adquirir lock atomicamente
WITH lock_attempt AS (
  INSERT INTO orchestrator_locks (project_id, execution_id)
  VALUES ($1::uuid, $2::text)
  ON CONFLICT (project_id) DO NOTHING
  RETURNING project_id
)
SELECT
  (SELECT COUNT(*) FROM lock_attempt) > 0 AS lock_acquired,
  p.id, p.name, p.current_phase, p.status, p.budget_target, p.client_id,
  (SELECT COUNT(*) FROM approvals WHERE project_id = p.id AND status = 'pending'
     AND approval_type IN ('briefing_review','design_review','proposal_review')  -- combinado con PA-1
  ) as pending_approvals
FROM projects p WHERE p.id = $1::uuid LIMIT 1;
```

**Notas:**
- `$2` = `{{ $execution.id }}` (n8n auto-provee).
- `ON CONFLICT (project_id) DO NOTHING` → si ya hay lock, no inserta y `lock_acquired=false`.
- El SELECT de proyecto SIGUE retornando los datos aunque no se adquiera el lock — para que el IF posterior tenga datos para el respond.

### 3.4 Operaciones MCP (8 ops, una sola llamada atómica)

```javascript
[
  // 1. Modificar Load Project query
  {"type":"updateNode","nodeName":"Load Project","updates":{
    "parameters.query": "SELECT cleanup_orchestrator_zombies(); WITH lock_attempt AS (INSERT INTO orchestrator_locks (project_id, execution_id) VALUES ($1::uuid, $2::text) ON CONFLICT (project_id) DO NOTHING RETURNING project_id) SELECT (SELECT COUNT(*) FROM lock_attempt) > 0 AS lock_acquired, p.id, p.name, p.current_phase, p.status, p.budget_target, p.client_id, (SELECT COUNT(*) FROM approvals WHERE project_id = p.id AND status = 'pending' AND approval_type IN ('briefing_review','design_review','proposal_review')) as pending_approvals FROM projects p WHERE p.id = $1::uuid LIMIT 1",
    "parameters.options.queryReplacement": "={{ [$json.project_id, $execution.id] }}"
  }},
  // 2. Añadir Lock Acquired? IF
  {"type":"addNode","node":{
    "name":"Lock Acquired?","type":"n8n-nodes-base.if","typeVersion":2.2,
    "position":[-768,400],
    "parameters":{
      "conditions":{
        "options":{"version":2,"leftValue":"","caseSensitive":false,"typeValidation":"strict"},
        "conditions":[{"id":"mo-lock","leftValue":"={{ $json.lock_acquired }}",
          "operator":{"type":"boolean","operation":"true","singleValue":true}}],
        "combinator":"and"}}
  }},
  // 3. Añadir Respond Lock Conflict (terminal noOp)
  {"type":"addNode","node":{
    "name":"Respond Lock Conflict","type":"n8n-nodes-base.code","typeVersion":2,
    "position":[-512,500],
    "parameters":{"jsCode":"return [{json: {statusCode: 409, status: 'busy', message: 'Otro orchestrator ya esta procesando este proyecto. Reintenta en 5s.', retry_after: 5}}];"}
  }},
  // 4-5. Añadir Release Lock + reusarlo en cada rama final (12 ramas)
  {"type":"addNode","node":{
    "name":"Release Lock","type":"n8n-nodes-base.postgres","typeVersion":2.5,
    "position":[768,800],
    "parameters":{
      "operation":"executeQuery",
      "query":"DELETE FROM orchestrator_locks WHERE project_id = $1::uuid",
      "options":{"queryReplacement":"={{ [$('Prepare Project Data').first().json.id] }}"}
    },
    "credentials":{"postgres":{"id":"cfxNZdzy0NB3xkYC","name":"Postgres account"}}
  }},
  // 6. Reorganizar conexiones: Load Project → Lock Acquired? (en lugar de directo a Prepare Project Data)
  {"type":"removeConnection","source":"Load Project","target":"Prepare Project Data","ignoreErrors":true},
  {"type":"addConnection","source":"Load Project","target":"Lock Acquired?"},
  {"type":"addConnection","source":"Lock Acquired?","target":"Prepare Project Data","branch":"true"},
  {"type":"addConnection","source":"Lock Acquired?","target":"Respond Lock Conflict","branch":"false"}
  // 7. Conectar Release Lock antes de TODOS los Respond X (21 conexiones).
  //    POSPUESTO — ver sección 4.
]
```

---

## 4. Decisión bloqueante (Damián)

El paso "Release Lock antes de cada Respond" requiere reorganizar 21 conexiones (cada `Log X` → `Respond X` se interpone con un `Release Lock`). Es **invasivo**.

**Alternativa más simple:** confiar en `cleanup_orchestrator_zombies()` que se ejecuta al INICIO del próximo invoke. Los locks que no se liberen explícitamente se limpian a los 10 min. Funciona pero significa que durante esos 10 min un proyecto está bloqueado a re-trigger orchestrator.

**Variantes a discutir con Damián:**

- **A**: Release Lock en cada Respond X (21 conexiones, invasivo, "perfecto"). +30 min implementación.
- **B**: Solo cleanup_zombies + lock TTL 10 min (mínimo cambio, "good enough"). +5 min.
- **C**: TTL 10 min + cron `cron_release_orchestrator_locks` ejecutándose cada 5 min (proactivo). +15 min.

**Recomendación: B**. Para la realidad single-tenant actual de Damián, 10 min de bloqueo en el peor caso es aceptable y simplifica el flow a 4 nodos nuevos en lugar de 22+.

---

## 5. Validación post-aplicación

### 5.1 Test stress (forzar race condition)

```bash
# Disparar 2 webhooks simultáneos al mismo project_id
for i in 1 2 3 4 5; do
  curl -X POST -H 'X-API-Key: $API_KEY' \
    -d '{"project_id":"PROJECT_ID_TEST"}' \
    https://n8n-n8n.zzeluw.easypanel.host/webhook/orchestrator &
done
wait

# Esperado: 1 procesa, 4 reciben 409 con retry_after.
```

### 5.2 SQL de monitor

```sql
-- Locks actuales
SELECT * FROM orchestrator_locks;

-- Locks zombies (>10min)
SELECT * FROM orchestrator_locks WHERE locked_at < now() - INTERVAL '10 minutes';

-- Ejecutar cleanup manual
SELECT cleanup_orchestrator_zombies();
```

---

## 6. Rollback

```javascript
n8n_update_partial_workflow({id: "EF5lPbSNlmA3Upt1", intent: "Rollback PA-4", operations: [
  {"type":"removeNode","nodeName":"Lock Acquired?"},
  {"type":"removeNode","nodeName":"Respond Lock Conflict"},
  {"type":"removeNode","nodeName":"Release Lock"},
  {"type":"updateNode","nodeName":"Load Project","updates":{
    "parameters.query": "<SQL ORIGINAL DE PA-1 SIN LOCK>",
    "parameters.options.queryReplacement": "={{ [$json.project_id] }}"
  }}
]})
```

Migración 054 NO se revierte (la tabla `orchestrator_locks` queda vacía sin uso).

---

## 7. Cómo aplicar este plan

1. **Damián elige variante A/B/C** (sección 4).
2. **Aplicar migración 054** en Supabase (ejecutar SQL de sección 3.1 manualmente).
3. **Aplicar operaciones MCP** (sección 3.4 con la variante elegida).
4. **Test stress** (sección 5.1).
5. **Snapshot** + commit B47.

---

## 8. Dependencia con PA-1

PA-4 incluye en su SQL el cambio de PA-1 (filtro por `approval_type IN (...)`). **Aplicar PA-1 primero** y verificar antes de pasar a PA-4. Si PA-1 ya está aplicado, copiar el SELECT actualizado al script de PA-4.
