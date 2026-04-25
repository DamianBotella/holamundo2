# `cron_post_phase_audits` — Auto-trigger de auditorías por fase

## Estado

- **Workflow**: `UyfJNFuf17w2BmFU`. Activo. Schedule cada 30 minutos.
- **Webhook manual**: `POST /webhook/trigger-audits-cron` (para test/forzar ejecución).
- **Última revisión**: 2026-04-25.

## Propósito

Asegurar que **todo proyecto que pase una fase relevante reciba sus auditorías obligatorias automáticamente**, sin que el arquitecto tenga que invocarlas manualmente. Resuelve el "olvido sistemático" de generar EBSS y verificación de accesibilidad antes de iniciar obra.

## Lógica del cron

Cada 30 minutos:

1. **Find Pending Audits** — Query SQL que devuelve dos tipos de audits pendientes:

   ```sql
   -- accessibility pendiente
   SELECT 'accessibility' as audit_type, p.id, p.name
   FROM projects p
   WHERE p.status = 'active'
     AND p.current_phase IN ('design_done','analysis_done','costs_done',
                             'trades_done','proposal_done','approved','planning_done')
     AND NOT EXISTS (
       SELECT 1 FROM accessibility_audits a
       WHERE a.project_id = p.id
         AND a.created_at > NOW() - INTERVAL '30 days'
     )
   
   UNION ALL
   
   -- safety_plan pendiente
   SELECT 'safety_plan' as audit_type, p.id, p.name
   FROM projects p
   WHERE p.status = 'active'
     AND p.current_phase IN ('approved','planning_done')
     AND NOT EXISTS (
       SELECT 1 FROM safety_plans s
       WHERE s.project_id = p.id
         AND s.created_at > NOW() - INTERVAL '60 days'
     )
   ```

2. **Has Pending?** — IF check: si hay items, continúa al routing; si no, log "no pending" y termina.

3. **Route by Audit Type** — Switch:
   - `audit_type === 'accessibility'` → invoca `agent_accessibility`.
   - `audit_type === 'safety_plan'` → invoca `agent_safety_plan`.

4. **Log Activity** — Registra cada audit triggered en `activity_log`.

## Reglas de auto-trigger

| Auditoría | Disparada en fases | Anti-spam (no re-disparar si hay) |
|---|---|---|
| `accessibility` | design_done → planning_done | audit < 30 días |
| `safety_plan` | approved, planning_done | safety_plan < 60 días |

Estos plazos evitan ejecuciones redundantes pero permiten regeneración periódica si el design o el alcance cambiaron significativamente.

## Cuándo se actualiza una auditoría

El cron NO modifica auditorías existentes — siempre crea una nueva versión. Si el arquitecto quiere forzar una regeneración (porque cambió el design tras la primera auditoría), basta con eliminar la audit reciente y el cron la recreará en el siguiente tick.

Mejora futura: tras aprobación de design, el `main_orchestrator` podría invalidar (status='superseded') las accessibility_audits previas para que el cron las re-genere inmediatamente.

## Test manual

Para forzar una ejecución sin esperar el siguiente tick:

```bash
curl -X POST https://n8n-n8n.zzeluw.easypanel.host/webhook/trigger-audits-cron \
  -H "Content-Type: application/json" -d '{}'
```

## Observabilidad

Cada ejecución registra en `activity_log`:
- Si encontró pendientes y las disparó → `action='auto_audit_triggered'` con detalle por audit.
- Si no había pendientes → `action='check_completed'` con `output_summary='No pending audits'`.

Para revisar últimos triggers:

```sql
SELECT created_at, project_id, action, output_summary
FROM activity_log
WHERE agent_name = 'cron_post_phase_audits'
ORDER BY created_at DESC
LIMIT 20;
```

## Integración con resto del sistema

Este cron se complementa con:
- `cron_project_review` (6h) — detecta proyectos huérfanos.
- `cron_consultation_batch` (4h) — re-notifica consultas.

Los tres crons tienen el patrón "monitor + actuar" sin necesidad de modificar el `main_orchestrator`. Esto es deliberado: el orchestrator gobierna el pipeline lineal del proyecto; los crons gobiernan tareas transversales que se aplican en momentos específicos.

## Verificado E2E (2026-04-25)

Ejecución 668 del cron:
- Detectó proyecto antiguo `22c7e914` (planning_done) sin auditorías recientes.
- Disparó `agent_accessibility` → audit `31f14b04` generado en 6.7s.
- Disparó `agent_safety_plan` → safety_plan `0e21f17d` con Google Doc poblado.
- Total ejecución: 17.8s.
- Log Activity registrado para ambos.

## Espacio para Damián

```
## Mis observaciones tras ejecución del cron

- Casos donde la auditoría auto-generada me ahorró tiempo: ...
- Casos donde tuve que regenerar manualmente: ...
- Mejoras que sugeriría: ...
```
