-- 073: amplia v_agent_studio_state con last_action_text + last_action_at
-- Plan B70 (X7 Oficina Viva): la burbuja sobre el agente debe mostrar la
-- accion concreta del ultimo activity_log (ej. "briefing_complete",
-- "design_option_selected") en vez del texto fijo "Trabajando".
--
-- CREATE OR REPLACE VIEW solo permite ANIADIR columnas al final, no
-- reordenar/eliminar. Mantenemos las 13 originales + 2 nuevas.

BEGIN;

CREATE OR REPLACE VIEW v_agent_studio_state AS
WITH active AS (
  SELECT
    ae.agent_name,
    COUNT(*) FILTER (WHERE ae.status = 'running')                                                AS active_count,
    COUNT(*) FILTER (WHERE ae.status = 'failed' AND ae.started_at > now() - interval '1 hour')   AS recent_failures,
    MAX(ae.started_at) FILTER (WHERE ae.status = 'running')                                       AS last_started_at,
    ARRAY_AGG(DISTINCT ae.project_id) FILTER (WHERE ae.status = 'running')                       AS active_project_ids
  FROM agent_executions ae
  WHERE ae.started_at > now() - interval '24 hours'
  GROUP BY ae.agent_name
),
pending AS (
  SELECT
    CASE a.approval_type
      WHEN 'briefing_review'     THEN 'agent_briefing'
      WHEN 'design_review'       THEN 'agent_design'
      WHEN 'proposal_review'     THEN 'agent_proposal'
      WHEN 'proposal_send'       THEN 'agent_proposal'
      WHEN 'trade_request_send'  THEN 'agent_trades'
      WHEN 'external_contact'    THEN 'main_orchestrator'
      WHEN 'project_close'       THEN 'main_orchestrator'
      ELSE                            'main_orchestrator'
    END AS agent_name,
    COUNT(*) AS pending_count
  FROM approvals a
  WHERE a.status = 'pending'
  GROUP BY 1
),
last_act AS (
  SELECT DISTINCT ON (al.agent_name)
    al.agent_name,
    al.action     AS last_action_text,
    al.created_at AS last_action_at
  FROM activity_log al
  WHERE al.created_at > now() - interval '2 hours'
  ORDER BY al.agent_name, al.created_at DESC
)
SELECT
  c.agent_name,
  c.display_name,
  c.category,
  c.room_id,
  c.default_position,
  c.sprite_id,
  c.description,
  c.display_order,
  CASE
    WHEN COALESCE(p.pending_count, 0)   > 0 THEN 'waiting_approval'
    WHEN COALESCE(a.active_count, 0)    > 0 THEN 'working'
    WHEN COALESCE(a.recent_failures, 0) > 0 THEN 'failed'
    ELSE 'idle'
  END                                       AS state,
  COALESCE(a.active_count, 0)               AS active_count,
  COALESCE(p.pending_count, 0)              AS pending_approvals_count,
  COALESCE(a.recent_failures, 0)            AS recent_failures,
  a.last_started_at,
  a.active_project_ids,
  la.last_action_text,
  la.last_action_at
FROM agents_catalog c
LEFT JOIN active   a  ON a.agent_name  = c.agent_name
LEFT JOIN pending  p  ON p.agent_name  = c.agent_name
LEFT JOIN last_act la ON la.agent_name = c.agent_name
ORDER BY c.display_order;

INSERT INTO applied_migrations (filename, notes) VALUES
  ('073_studio_view_last_action.sql', 'B70 X7 Oficina Viva: anade last_action_text/last_action_at desde activity_log (2h)')
ON CONFLICT (filename) DO NOTHING;

COMMIT;

-- Verificacion
SELECT agent_name, state, last_action_text, last_action_at
FROM v_agent_studio_state
WHERE last_action_text IS NOT NULL
ORDER BY last_action_at DESC
LIMIT 5;

-- rollback: ejecutar 055_studio_view.sql original para restaurar las 13 columnas; DELETE FROM applied_migrations WHERE filename = '073_studio_view_last_action.sql';
