# X1 — Bugs descubiertos al intentar E2E real (2026-04-29 / B29)

**Estado X1**: ❌ NO CERTIFICADO. Bloqueado por 3 bugs detectados al intentar disparar el pipeline. 1 ya arreglado, 2 pendientes.

---

## Resumen ejecutivo

Se intentó disparar `init_new_project → main_orchestrator → 13 agentes` con un proyecto stub real (`Reforma DEMO X1c E2E B29`, project_id `d5bdcc4f-76a3-47f2-a425-fe5ce776b045`). El proyecto **se creó en la BD** pero **el orquestador nunca corrió ningún agente**. Causa: tres bugs que el Reality Checker no había detectado porque solo audita estado estático, no flujos.

Esto **confirma con datos** la advertencia del Reality Checker en B27: "absence of error ≠ proof of success". El pipeline nunca había sido ejecutado E2E con datos reales recientes — y al intentarlo hoy, ha fallado por motivos distintos a los que ya conocíamos.

---

## Bug 1 — `check_rate_limit` duplicada en BD ✅ ARREGLADO

**Descubrimiento**: al disparar init_new_project recibió error `function check_rate_limit(unknown, unknown, integer) is not unique`.

**Causa raíz**: dos versiones de la función en BD:
- Migration 008: `check_rate_limit(text, text, integer) RETURNS text` ('allowed'/'blocked')
- Migration 029: `check_rate_limit(text, text, integer, integer) RETURNS TABLE(allowed bool, reason text, ...)`

La segunda **NO sustituyó** a la primera (no hizo DROP). PostgreSQL no podía resolver llamadas con 3 args ambiguamente.

**Fix aplicado en B29**:
- Migration 047 `047_drop_check_rate_limit_v1.sql`: `DROP FUNCTION check_rate_limit(text, text, integer)`. Solo queda la nueva.
- Workflow `util_webhook_security` (`EipFM8h08uTX1mBn`) ajustado: query del nodo `Rate Limit + Audit` ahora llama la firma de 4 args con `max_per_hour = max_per_minute * 60` y mapea `allowed bool → 'allowed'/'blocked' text` para no romper el contrato de output.

**Verificado**: tras el fix, `init_new_project` corre sin error de función. El proyecto se crea en BD.

---

## Bug 2 — `util_notification` devuelve array vacío y corta el pipeline ❌ PENDIENTE

**Descubrimiento**: `init_new_project` ejecución 2049 (post-fix Bug 1) llegó hasta `Call 'util_notification'` con `itemsOutput: 0`. Los siguientes nodos (`Prepare Orchestrator Payload`, `Trigger Orchestrator`, `Respond 201 Created`) **NO se ejecutaron**.

**Comportamiento n8n estándar**: si un sub-workflow devuelve `[[]]` (array vacío), los nodos siguientes en la rama main se omiten. El flujo termina silenciosamente con status='success'.

**Resultado real**: el proyecto SE CREA en BD, los archivos de Drive SE CREAN, el log se inserta. Pero **main_orchestrator nunca recibe el trigger** → el pipeline no arranca → ningún agente corre.

**Probable causa raíz**: el sub-workflow `util_notification` (`ks2CqrtJCxLJTPdV`) tiene una rama con `IF` que cuando no necesita enviar email, devuelve `[]` en lugar de un objeto con `{sent: false}`.

**Fix necesario** (próxima sesión):
1. Auditar `util_notification` workflow.
2. Asegurar que SIEMPRE devuelve un objeto JSON `{sent: bool, ...}`, no array vacío.
3. Reintentar pipeline con nuevo proyecto stub.

**Workaround temporal**: se puede disparar manualmente `main_orchestrator` con el `project_id` del proyecto stub ya creado.

---

## Bug 3 — `main_orchestrator` no acepta input de sub-workflow correctamente ❌ PENDIENTE

**Descubrimiento**: al intentar disparar `main_orchestrator` desde un workflow temporal via `executeWorkflow` con payload `{project_id: "d5bdcc4f-..."}`, el nodo `Extract Input` lanzó `Error: project_id es obligatorio [line 7]`.

**Causa probable**: `Extract Input` está escrito esperando el formato webhook (`$input.first().json.body.project_id`) en lugar del formato sub-workflow (`$input.first().json.project_id`). La estructura del workflow tiene 2 triggers (`Orchestrator Entry` webhook + `Execute Workflow Trigger`) pero el `Extract Input` parece asumir solo el primero.

**Fix necesario**:
1. Revisar `Extract Input` jsCode en `main_orchestrator`.
2. Hacer que detecte ambos formatos:
   ```javascript
   const input = $input.first().json;
   const projectId = input.project_id || (input.body && input.body.project_id);
   if (!projectId) throw new Error('project_id es obligatorio');
   ```

---

## Bugs latentes adicionales (sospechados, no confirmados)

- **`agent_executions` está vacío** para el proyecto creado hoy → todos los agentes están sin ejecutarse. NO sabemos si funcionarían si llegaran a recibir input correcto.
- **Wait nodes de aprobación** (briefing/design/proposal) — no probados con auto-aprobación.
- **Pipeline cross-agent** (handoff de outputs entre fases) — no probado.

---

## Recomendaciones para X1 v2 (próxima sesión)

### Pre-requisitos antes de arrancar X1 de nuevo

1. **Arreglar Bug 2** — `util_notification` debe devolver objeto siempre.
2. **Arreglar Bug 3** — `main_orchestrator.Extract Input` compatible con ambos formatos.
3. **Crear workflow `TEMP_x1_pipeline_runner`** (más completo que el de hoy) que:
   - Dispara init_new_project con auth.
   - Espera unos segundos.
   - Pollea `agent_executions` cada N segundos.
   - Cuando detecta una aprobación pendiente, dispara automáticamente el resume webhook con `?action=approve`.
   - Sale cuando `current_phase = 'approved'` o `proposal_done`.

### Datos del proyecto stub creado hoy (reutilizable)

```
project_id: d5bdcc4f-76a3-47f2-a425-fe5ce776b045
client_id:  cc5d970d-7e19-482d-bd12-4b359ac8905f
name:       Reforma DEMO X1c E2E B29
phase:      intake (no avanzó)
client:     Cliente Demo X1c (demo.cliente.x1c@arquitai.com)
drive_root: 1FSURmokSq9kJxW63_FGbT_Q5Fo6nhLjZ
```

Si decidimos limpiar antes de X1 v2:

```sql
DELETE FROM activity_log WHERE project_id = 'd5bdcc4f-76a3-47f2-a425-fe5ce776b045';
DELETE FROM projects WHERE id = 'd5bdcc4f-76a3-47f2-a425-fe5ce776b045';
DELETE FROM clients WHERE id = 'cc5d970d-7e19-482d-bd12-4b359ac8905f';
```

---

## Lo que SÍ se logró en esta sesión (B29)

- ✅ Migration 047 aplicada (DROP duplicado check_rate_limit).
- ✅ `util_webhook_security` ajustado a la firma nueva.
- ✅ Confirmado que `init_new_project` puede ahora pasar el security check.
- ✅ Project + client creados correctamente en BD.
- ✅ `util_file_organizer` funciona (creó 6 carpetas Drive).
- ✅ Documentación de los 3 bugs encontrados.
- ✅ Eliminado workflow temporal de prueba.

**Veredicto X1**: NO CERTIFICADO. Pipeline detenido en `init_new_project`'s `util_notification`. Los 13 agentes NO han corrido. **No se puede declarar E2E como funcionando** hasta arreglar Bug 2 y Bug 3.

**Backend status**: NEEDS WORK. Migrations OK, schema OK, pero pipeline runtime tiene bugs no detectables sin tráfico real. Esto sigue confirmando que el patrón "drift silencioso" se extiende más allá del schema.

---

## Lección operativa

El Reality Checker en B27 dijo "absence of error ≠ proof of success". B29 lo demuestra:
- Health check ✅
- Schema ✅
- Migrations ✅
- Workflows activos ✅
- **Pipeline real ❌** — no había manera de saberlo sin ejecutarlo.

**Implica**: necesitamos cron `cron_e2e_smoke_test` que **dispare un proyecto stub auto-cleanup cada N días** y verifique que los 13 agentes corren. Sin esto, los bugs se acumulan invisible. Esto es candidato fuerte para añadir al plan de sesiones X1.
