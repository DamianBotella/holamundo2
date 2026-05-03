# PA-1 — Plan ejecutable: scope `pending_approvals` por approval_type

**Fecha plan:** 2026-05-03 (B45, sesión autónoma)
**Estado:** documentado, **NO aplicado** (requiere decisión Damián)
**Esfuerzo estimado:** 5 min aplicar, 30 min validar.

---

## 1. Estado actual (confirmado en prod)

`Load Project` ejecuta:

```sql
SELECT p.id, p.name, p.current_phase, p.status, p.budget_target, p.client_id,
  (SELECT COUNT(*) FROM approvals WHERE project_id = p.id AND status = 'pending') as pending_approvals
FROM projects p WHERE p.id = $1::uuid LIMIT 1
```

Y el IF `Pending Approvals?` enruta a `Respond Waiting Approval` si `pending_approvals > 0`. **Sin filtrar por `approval_type`**.

---

## 2. Inventario real de approval_types (mvp_schema.sql:447)

```sql
CHECK (approval_type IN (
  'briefing_review',     -- bloquea fase: intake → briefing_done (arquitecto aprueba)
  'design_review',       -- bloquea fase: briefing_done → design_done (arquitecto selecciona)
  'external_contact',    -- evento: agent_regulatory consulta entidad externa, NO bloquea fase
  'trade_request_send',  -- evento: agent_trades envía solicitud gremio, NO bloquea fase
  'proposal_review',     -- bloquea fase: trades_done → proposal_done (arquitecto revisa propuesta)
  'proposal_send',       -- evento: enviar propuesta al cliente, NO bloquea fase
  'project_close'        -- evento: cerrar proyecto, NO bloquea fase
))
```

**Confirmado en producción**: hoy hay 3 INSERTs en `approvals` desde los workflows críticos:
- `agent_briefing` → `'briefing_review'`
- `agent_design` → `'design_review'`
- `agent_regulatory` → `'external_contact'`

Los otros 4 (`trade_request_send`, `proposal_review`, `proposal_send`, `project_close`) están en el schema pero no tienen workflows que los generen aún.

---

## 3. Dos variantes de fix

### Variante A — Conservadora (recomendada)

Filtrar el COUNT por los 3 approval_types que son **fase-bloqueantes**:

```sql
SELECT p.id, p.name, p.current_phase, p.status, p.budget_target, p.client_id,
  (SELECT COUNT(*) FROM approvals
   WHERE project_id = p.id
     AND status = 'pending'
     AND approval_type IN ('briefing_review', 'design_review', 'proposal_review')
  ) as pending_approvals
FROM projects p WHERE p.id = $1::uuid LIMIT 1
```

**Ventajas:**
- Cambio mínimo, 1 línea SQL, máxima reversibilidad.
- Desbloquea proyectos que tienen `external_contact` o `trade_request_send` pendientes.
- No requiere mapeo phase-específico.

**Desventajas:**
- Si Damián añade futuros workflows con approval_types nuevos (por ejemplo `safety_plan_review`), hay que actualizar la lista.

### Variante B — Estricta (matriz phase → approval_type)

Filtrar también por la fase específica que cada approval bloquea:

```sql
SELECT p.id, p.name, p.current_phase, p.status, p.budget_target, p.client_id,
  (SELECT COUNT(*) FROM approvals WHERE project_id = p.id AND status = 'pending'
    AND approval_type = CASE p.current_phase
      WHEN 'intake'        THEN 'briefing_review'
      WHEN 'briefing_done' THEN 'design_review'
      WHEN 'trades_done'   THEN 'proposal_review'
      ELSE 'never_match'
    END
  ) as pending_approvals
FROM projects p WHERE p.id = $1::uuid LIMIT 1
```

**Ventajas:**
- Semánticamente perfecto: solo la approval específica de la fase actual bloquea.
- Si hay 2 approvals de tipos distintos en el mismo proyecto (raro), maneja correctamente.

**Desventajas:**
- Más invasivo, más test cases.
- Asume que solo hay 1 approval bloqueante por fase (cierto hoy, podría no serlo mañana).

---

## 4. La operación MCP exacta (variante A recomendada)

```javascript
n8n_update_partial_workflow({
  id: "EF5lPbSNlmA3Upt1",
  intent: "PA-1: scope pending_approvals query a tipos fase-bloqueantes",
  operations: [{
    type: "updateNode",
    nodeName: "Load Project",
    updates: {
      "parameters.query": "SELECT p.id, p.name, p.current_phase, p.status, p.budget_target, p.client_id, (SELECT COUNT(*) FROM approvals WHERE project_id = p.id AND status = 'pending' AND approval_type IN ('briefing_review', 'design_review', 'proposal_review')) as pending_approvals FROM projects p WHERE p.id = $1::uuid LIMIT 1"
    }
  }]
})
```

**Total: 1 operación.** Mínimo riesgo, reversible al 100% (revertir = volver al SQL original).

---

## 5. Validación post-aplicación

### 5.1 SQL de auditoría sobre Supabase (Damián ejecuta)

```sql
-- ¿Qué approval_types están pendientes en proyectos activos?
SELECT
  p.id, p.name, p.current_phase,
  COUNT(*) FILTER (WHERE a.status = 'pending') AS total_pending,
  COUNT(*) FILTER (WHERE a.status = 'pending' AND a.approval_type = 'briefing_review') AS briefing_review,
  COUNT(*) FILTER (WHERE a.status = 'pending' AND a.approval_type = 'design_review') AS design_review,
  COUNT(*) FILTER (WHERE a.status = 'pending' AND a.approval_type = 'external_contact') AS external_contact,
  COUNT(*) FILTER (WHERE a.status = 'pending' AND a.approval_type = 'proposal_review') AS proposal_review
FROM projects p
LEFT JOIN approvals a ON a.project_id = p.id
WHERE p.status = 'active' AND p.current_phase != 'archived'
GROUP BY p.id, p.name, p.current_phase
HAVING COUNT(*) FILTER (WHERE a.status = 'pending') > 0
ORDER BY total_pending DESC;
```

Si esta query devuelve filas con `external_contact > 0` y otras columnas a 0, esos son los proyectos hoy bloqueados injustamente que el fix desbloqueará.

### 5.2 Test inmediato post-fix

```javascript
n8n_validate_workflow({id: "EF5lPbSNlmA3Upt1", options: {profile: "runtime"}})
```

Esperado: sin nuevos errores, los warnings de typeVersion siguen igual.

---

## 6. Rollback

```javascript
n8n_update_partial_workflow({
  id: "EF5lPbSNlmA3Upt1",
  intent: "Rollback PA-1 — volver al filtro global",
  operations: [{
    type: "updateNode",
    nodeName: "Load Project",
    updates: {
      "parameters.query": "SELECT p.id, p.name, p.current_phase, p.status, p.budget_target, p.client_id, (SELECT COUNT(*) FROM approvals WHERE project_id = p.id AND status = 'pending') as pending_approvals FROM projects p WHERE p.id = $1::uuid LIMIT 1"
    }
  }]
})
```

---

## 7. Cómo aplicar este plan

1. **Damián decide entre Variante A (recomendada) o B**.
2. **Damián ejecuta la query SQL de auditoría** (sección 5.1) en Supabase para entender el universo de approvals.
3. **Aplicar la operación MCP** (sección 4).
4. **Verificar con `n8n_validate_workflow`** + revisar `Load Project` con `n8n_get_workflow mode=structure`.
5. **Snapshot** + commit B46 (X2 PA-1 aplicado).
