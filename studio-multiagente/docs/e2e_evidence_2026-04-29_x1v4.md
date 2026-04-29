# E2E Evidence — X1v4 (2026-04-29 / B32)

**Estado**: 🟢 Pipeline avanza. **3/13 agentes certificados E2E**. Bugs 5 y 6 detectados + arreglados (constraint regulatory + exec_status sync). X1v5 pendiente para certificar restantes.

---

## TL;DR

X1v4 demostró que el fix de syntax B31 funcionó (regulatory ahora corre exitosamente y guarda 20 regulatory_tasks). Pero al avanzar la cascada se encontraron 2 bugs nuevos:

- **Bug 5**: el constraint `regulatory_tasks_task_type_check` no incluía los nuevos task_types del prompt v2 (mi propio bug B26 — actualicé prompt sin actualizar schema). **Fix**: migration 048 aplicada.
- **Bug 6**: agent_materials buscaba `design_options.exec_status='confirmed'` pero las aprobaciones SQL manuales en X1v2 solo actualizaron `is_selected=true`. **Fix**: UPDATE manual SET exec_status='confirmed' a design_options/briefings/regulatory_tasks.

**Avance del pipeline** sobre proyecto `0a53d09f-d8f7-444a-a074-42a3305ef49b`:
- Phase: design_done → analysis_done ✅
- agent_briefing: completed ✅
- agent_design: completed ✅
- agent_regulatory: completed (20 tasks creadas) ✅
- agent_materials: bloqueado por Bug 6 → fix aplicado, pendiente re-trigger en X1v5
- agent_costs/proposal/planner/memory: no ejecutados aún

---

## Bug 5 detallado — task_type constraint vs prompt v2

**Síntoma**: agent_regulatory ejecutaba el LLM (10s), parseaba 4 task_types correctamente, pero fallaba al INSERT en regulatory_tasks con `violates check constraint regulatory_tasks_task_type_check`.

**Causa raíz**: en B26 amplié el prompt v2 para que generase task_types nuevos (`certificado_eficiencia_energetica`, `proyecto_tecnico`, `estudio_seguridad_salud`, `estudio_basico_ss`, `gestion_rcd`, `boletines_instalaciones`, `cumplimiento_db_sua_accesibilidad`, `cedula_compatibilidad_urbanistica`). Pero **NO actualicé el CHECK constraint** de la tabla. El LLM produce el output correcto pero la BD lo rechaza.

**Fix aplicado**: migration `048_regulatory_tasks_task_type_constraint_v2.sql`:
```sql
ALTER TABLE regulatory_tasks DROP CONSTRAINT regulatory_tasks_task_type_check;
ALTER TABLE regulatory_tasks ADD CONSTRAINT regulatory_tasks_task_type_check
  CHECK (task_type IN ('licencia_obra', 'comunicacion_previa', 'permiso_comunidad',
    'certificado_habitabilidad', 'cedula_urbanistica', 'cedula_compatibilidad_urbanistica',
    'informe_tecnico', 'proyecto_tecnico', 'estudio_seguridad_salud', 'estudio_basico_ss',
    'certificado_eficiencia_energetica', 'gestion_rcd', 'boletines_instalaciones',
    'cumplimiento_db_sua_accesibilidad', 'otro'));
```

**Lección operativa**: cambiar prompts que afectan output structure SIN actualizar schema constraint = bug latente garantizado. Pattern propuesto X1v5: **toda actualización de prompt que define ENUMs debe incluir migration de schema sincronizada**.

**Verificación**: tras aplicar migration 048, agent_regulatory corrió **5 veces exitosamente** en ~10s cada una, generando 20 regulatory_tasks en BD.

---

## Bug 6 detallado — exec_status sync entre tablas

**Síntoma**: agent_materials se ejecutaba (52ms), `Load Project` OK, `Load Selected Design Option` devolvía 0 filas, agent salía sin output. Orchestrator quedaba en analysis_done sin avanzar.

**Causa raíz**: agent_materials query es `SELECT ... FROM design_options WHERE project_id=? AND exec_status='confirmed'`. En X1v2 las aprobaciones manuales SQL solo actualizaron `is_selected=true` pero NO `exec_status='confirmed'`. La query no encontraba ninguna design_option, agent_materials no podía continuar.

**Fix aplicado en B32**:
```sql
UPDATE design_options    SET exec_status='confirmed' WHERE project_id=... AND exec_status='draft';
UPDATE briefings         SET exec_status='confirmed' WHERE project_id=... AND exec_status='draft';
UPDATE regulatory_tasks  SET exec_status='confirmed' WHERE project_id=... AND exec_status='draft';
```

**Lección operativa**: el sistema usa **dos campos paralelos para "approved"**: `is_selected/status='approved'` (para humanos) y `exec_status='confirmed'` (para agentes downstream). Las aprobaciones SQL deben actualizar ambos. **TODO X1v5**: actualizar el patrón de UPDATE manual para que SIEMPRE setee `exec_status='confirmed'` cuando `is_selected/approved`.

---

## Evidencia E2E recolectada

### agent_briefing (B30 X1v2)
- Workflow id: uq3GQWSdmoIV4ZdR
- Duración LLM: ~3min (real, no atascado)
- Output: 1 fila en `briefings`, version=1, status=approved (manual SQL)
- Summary: 175 chars
- Outputs reales generados en BD ✅

### agent_design (B30 X1v2)
- Workflow id: sMGf7e8CSnsBQa1q
- Duración LLM: 1m25s
- Output: **3 filas** en `design_options`, 1 marcada is_selected
- Outputs reales generados en BD ✅

### agent_regulatory (B32 X1v4) ⭐ NUEVO
- Workflow id: QbRMmQs0oyVHplgE
- Duración LLM: ~10s × 5 ejecuciones (orchestrator se disparó múltiples veces tras fix)
- Output: **20 regulatory_tasks creadas** con task_types como `licencia_obra`, `permiso_comunidad`, `certificado_eficiencia_energetica`, `proyecto_tecnico`, etc. (¡los nuevos del prompt v2!)
- Citation_source en cada task: ej "CTE DB-SE Art. 1, PGOU Madrid Art. ...", "Ley de Propiedad Horizontal Art. 7", "RD 235/2013 Art. 3"
- Outputs reales generados en BD ✅

---

## Estado de los 13 agentes

| # | Agente | Syntax (X1v3) | E2E ejecutado | Outputs en BD | Bugs encontrados |
|---|---|---|---|---|---|
| 1 | agent_briefing | ✅ | ✅ B30 | ✅ briefings | - |
| 2 | agent_design | ✅ | ✅ B30 | ✅ design_options × 3 | - |
| 3 | agent_regulatory | ✅ post-B31 | ✅ B32 | ✅ regulatory_tasks × 20 | Bug 4 (B26 paren) + Bug 5 (B26 constraint) |
| 4 | agent_materials | ✅ post-B31 | ❌ bloqueado | - | Bug 6 (exec_status) - fix aplicado, no verificado |
| 5 | agent_documents (no LLM) | n/a | ❌ no ejecutado | - | - |
| 6 | agent_costs | ✅ post-B31 | ❌ no ejecutado | - | - |
| 7 | agent_trades (no LLM) | n/a | ❌ no ejecutado | - | - |
| 8 | agent_proposal | ✅ | ❌ no ejecutado | - | - |
| 9 | agent_planner | ✅ | ❌ no ejecutado | - | - |
| 10 | agent_memory | ✅ | ❌ no ejecutado | - | - |
| 11 | agent_safety_plan | ✅ | ❌ no ejecutado | - | - |
| 12 | agent_accessibility | ✅ | ❌ falló (Bug 5) | - | Bug 5 - fix aplicado, no verificado |
| 13 | agent_briefing-revision | ✅ | n/a (mismo workflow) | n/a | - |

**3/13 certificados E2E con outputs reales en BD**.

---

## Pendiente para X1v5 (próxima sesión)

### 🔴 P0 — Reanudar cascada con fixes B32 aplicados
1. Re-trigger orchestrator sobre proyecto `0a53d09f-...` (analysis_done).
2. Verificar agent_materials ahora carga design_options correctamente.
3. Continuar agent_costs → agent_documents → agent_trades.
4. Auto-aprobar proposal cuando llegue (UPDATE doble: status + exec_status).
5. Continuar agent_planner → agent_memory.
6. Capturar evidence final de los **10 agentes restantes**.

### 🟡 P1 — Crear util_auto_approve workflow
Para reemplazar las cadenas de UPDATE SQL manuales. Reciba `approval_id` y haga el doble update (status='approved' + exec_status='confirmed') consistentemente.

### 🟡 P2 — Documentar pattern dual exec_status para próximas integraciones
Cualquier nuevo agente o integración debe respetar el pattern: estados humanos vs estados agentes son distintos campos.

---

## Veredicto sistema

**Antes de X1v4**: 2/13 agentes certificados E2E.
**Después de X1v4**: **3/13 agentes certificados E2E** + 2 bugs adicionales (5 y 6) descubiertos y arreglados.

**De NEEDS WORK a NEEDS WORK con confianza progresiva**. Cada sesión X descubre y arregla 1-2 bugs nuevos del runtime real. Estimación: X1v5 + posiblemente X1v6 deberían certificar los 10 restantes.

---

## Migrations aplicadas en B32

```
048_regulatory_tasks_task_type_constraint_v2.sql  -- Sync constraint con prompt v2
```

Total migrations registradas en `applied_migrations`: 47 (003-046, 047, 048).
