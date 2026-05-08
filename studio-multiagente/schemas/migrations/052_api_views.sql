-- Migration 052: VIEWS SQL para la API (X5)
-- Fecha: 2026-05-03 (B55 — refinada del .draft tras audit schema)
--
-- Estas views son LA INTERFAZ que los workflows api_* consumen. La UI Foxhole
-- nunca toca tablas raw, siempre VIEWS. Esto da:
-- 1. Compatibilidad: si cambia un schema, solo se ajusta la VIEW.
-- 2. RLS automatico: las views heredan las policies de las tablas base.
-- 3. Performance: views pueden materializarse si hace falta.
--
-- Ajustes vs .draft:
-- - v_trade_overview: trade_assignments (no existe) -> trade_requests.
-- - v_agent_runs: cost_usd/tokens_in/tokens_out (no existen en agent_executions) eliminados.
-- - v_alerts UNION 4: agent_executions.error_message OK, ae.cost_usd eliminado.
-- - v_dashboard_metrics: agent_executions.cost_usd eliminado, llm_cost_mtd_usd via llm_calls si existe.

BEGIN;

-- ============================================================
-- v_project_summary
-- ============================================================
CREATE OR REPLACE VIEW v_project_summary AS
SELECT
  p.id,
  p.name,
  c.name AS client_name,
  p.current_phase,
  p.status,
  p.budget_target,
  p.location_city,
  p.created_at,
  p.updated_at,
  p.tenant_id,
  COALESCE((
    SELECT count(*)::int FROM activity_log al
     WHERE al.project_id = p.id
       AND al.status IN ('warning', 'failed', 'error')
       AND al.created_at > now() - interval '30 days'
  ), 0) AS alerts_count,
  COALESCE((
    SELECT count(*)::int FROM approvals a
     WHERE a.project_id = p.id AND a.status = 'pending'
  ), 0) AS pending_approvals_count
FROM projects p
JOIN clients c ON c.id = p.client_id;

COMMENT ON VIEW v_project_summary IS
  'Lista de proyectos con KPIs agregados. Consumida por GET /projects.';

-- ============================================================
-- v_project_detail
-- ============================================================
CREATE OR REPLACE VIEW v_project_detail AS
SELECT
  p.*,
  c.name             AS client_name,
  (
    SELECT row_to_json(b) FROM (
      SELECT id, version, summary, client_needs, objectives, constraints,
             rooms_affected, missing_info, open_questions, status,
             approved_at, created_at
        FROM briefings
       WHERE project_id = p.id
       ORDER BY version DESC LIMIT 1
    ) b
  ) AS briefing,
  (
    SELECT json_agg(d ORDER BY d.option_number) FROM (
      SELECT id, option_number, title, description, intervention_logic,
             rooms_layout, technical_notes, conflict_points, pros, cons,
             estimated_complexity, is_selected
        FROM design_options
       WHERE project_id = p.id
    ) d
  ) AS design_options,
  (
    SELECT json_agg(r ORDER BY r.priority, r.created_at) FROM (
      SELECT id, task_type, title, description, entity, required_docs,
             estimated_timeline, estimated_cost, priority, status,
             draft_message, created_at
        FROM regulatory_tasks
       WHERE project_id = p.id
    ) r
  ) AS regulatory_tasks,
  (
    SELECT row_to_json(ce) FROM (
      SELECT id, version, total_estimated, budget_target, deviation_pct,
             deviation_status, breakdown, scenarios, status, created_at
        FROM cost_estimates
       WHERE project_id = p.id
       ORDER BY version DESC LIMIT 1
    ) ce
  ) AS cost_estimate,
  (
    SELECT row_to_json(pr) FROM (
      SELECT id, version, title, executive_summary, total_price,
             status, sent_at, created_at
        FROM proposals
       WHERE project_id = p.id
       ORDER BY version DESC LIMIT 1
    ) pr
  ) AS proposal,
  (
    SELECT row_to_json(pl) FROM (
      SELECT id, version, phases, milestones, dependencies, critical_path,
             total_duration_days, start_date, end_date, status, created_at
        FROM project_plans
       WHERE project_id = p.id
       ORDER BY version DESC LIMIT 1
    ) pl
  ) AS project_plan
FROM projects p
JOIN clients c ON c.id = p.client_id;

COMMENT ON VIEW v_project_detail IS
  'Detalle completo del proyecto con relaciones agregadas en JSON. Consumida por GET /projects/{id}.';

-- ============================================================
-- v_timeline
-- ============================================================
CREATE OR REPLACE VIEW v_timeline AS
SELECT
  al.id,
  al.project_id,
  al.created_at AS timestamp,
  al.agent_name,
  al.action,
  al.status,
  al.output_summary,
  COALESCE(al.details, '{}'::jsonb) AS details
FROM activity_log al;

COMMENT ON VIEW v_timeline IS
  'Eventos cronologicos del proyecto. Consumida por GET /projects/{id}/timeline.';

-- ============================================================
-- v_agent_runs (simplificada: sin cost/tokens que no estan en agent_executions)
-- ============================================================
CREATE OR REPLACE VIEW v_agent_runs AS
SELECT
  ae.id,
  ae.project_id,
  ae.agent_name,
  ae.status,
  ae.started_at,
  ae.finished_at,
  CASE WHEN ae.finished_at IS NOT NULL
       THEN EXTRACT(EPOCH FROM (ae.finished_at - ae.started_at)) * 1000
       ELSE NULL
  END AS duration_ms,
  ae.error_message AS error
FROM agent_executions ae;

COMMENT ON VIEW v_agent_runs IS
  'Ejecuciones de agentes con duracion calculada. Consumida por GET /projects/{id}/agent-runs.';

-- ============================================================
-- v_alerts (4 fuentes UNION ALL)
-- ============================================================
CREATE OR REPLACE VIEW v_alerts AS
-- 1. Consultations pendientes
SELECT
  cq.id,
  cq.project_id,
  'consultation'::text AS type,
  CASE WHEN cq.consultation_type = 'directive_conflict' THEN 'critical'
       WHEN cq.consultation_type = 'decision' THEN 'warning'
       ELSE 'info'
  END AS severity,
  ('Consulta de ' || cq.agent_name)::text AS title,
  cq.message,
  cq.created_at,
  cq.answered_at AS resolved_at
FROM consultation_queue cq
WHERE cq.status IN ('pending', 'sent')

UNION ALL
-- 2. Approvals pendientes
SELECT
  a.id,
  a.project_id,
  'approval_pending'::text AS type,
  'warning'::text AS severity,
  ('Aprobacion pendiente: ' || a.approval_type)::text AS title,
  COALESCE(a.summary, 'Requiere decision humana') AS message,
  a.created_at,
  a.decided_at AS resolved_at
FROM approvals a
WHERE a.status = 'pending'

UNION ALL
-- 3. Regulatory warnings
SELECT
  rt.id,
  rt.project_id,
  'regulatory_warning'::text AS type,
  CASE WHEN rt.priority = 'critico' THEN 'critical'
       WHEN rt.priority = 'importante' THEN 'warning'
       ELSE 'info'
  END AS severity,
  rt.title,
  COALESCE(rt.description, '')::text AS message,
  rt.created_at,
  CASE WHEN rt.status = 'completed' THEN rt.updated_at ELSE NULL END AS resolved_at
FROM regulatory_tasks rt
WHERE rt.status NOT IN ('completed', 'not_required')
  AND rt.priority IN ('critico', 'importante')

UNION ALL
-- 4. Agent failures recientes (7 dias)
SELECT
  ae.id,
  ae.project_id,
  'agent_failure'::text AS type,
  'critical'::text AS severity,
  ('Fallo en ' || ae.agent_name)::text AS title,
  COALESCE(ae.error_message, 'Sin detalle') AS message,
  ae.started_at AS created_at,
  NULL::timestamptz AS resolved_at
FROM agent_executions ae
WHERE ae.status = 'failed'
  AND ae.started_at > now() - interval '7 days';

COMMENT ON VIEW v_alerts IS
  'Vista unificada de alertas: consultations + approvals + regulatory + agent_failures. Consumida por /projects/{id}/alerts y /alerts/global.';

-- ============================================================
-- v_dashboard_metrics
-- ============================================================
CREATE OR REPLACE VIEW v_dashboard_metrics AS
WITH phase_counts AS (
  SELECT current_phase, count(*)::int AS cnt
  FROM projects
  WHERE status = 'active'
  GROUP BY current_phase
),
totals AS (
  SELECT
    count(*) FILTER (WHERE status = 'active')::int AS active_projects,
    count(*) FILTER (WHERE status = 'active' AND current_phase = 'completed')::int AS completed_projects,
    SUM(budget_target) FILTER (WHERE status = 'active')::numeric AS revenue_pipeline_eur
  FROM projects
),
alert_counts AS (
  SELECT
    count(*) FILTER (WHERE severity = 'critical')::int AS critical_alerts,
    count(*) FILTER (WHERE type = 'approval_pending' AND resolved_at IS NULL)::int AS pending_approvals
  FROM v_alerts
  WHERE resolved_at IS NULL
),
llm_cost AS (
  SELECT COALESCE(SUM(llm_cost_estimated), 0)::numeric AS llm_cost_mtd_usd
  FROM activity_log
  WHERE created_at >= date_trunc('month', now())
    AND llm_cost_estimated IS NOT NULL
)
SELECT
  t.active_projects,
  COALESCE((SELECT jsonb_object_agg(current_phase, cnt) FROM phase_counts), '{}'::jsonb) AS projects_by_phase,
  ac.critical_alerts,
  ac.pending_approvals,
  COALESCE(t.revenue_pipeline_eur, 0)::numeric(14,2) AS revenue_pipeline_eur,
  ROUND(lc.llm_cost_mtd_usd::numeric, 2) AS llm_cost_mtd_usd
FROM totals t, alert_counts ac, llm_cost lc;

COMMENT ON VIEW v_dashboard_metrics IS
  'KPIs agregados del tenant para vista mapa global Foxhole. Consumida por GET /metrics/dashboard.';

-- ============================================================
-- v_trade_overview (corregido: trade_requests no trade_assignments)
-- ============================================================
CREATE OR REPLACE VIEW v_trade_overview AS
SELECT
  tr.id,
  tr.project_id,
  p.name AS project_name,
  tr.trade_type,
  tr.contact_name AS contractor_name,
  tr.contact_phone,
  tr.contact_email,
  tr.message_channel,
  tr.status,
  tr.sent_at,
  tr.response_deadline,
  tr.created_at,
  p.tenant_id
FROM trade_requests tr
JOIN projects p ON p.id = tr.project_id;

COMMENT ON VIEW v_trade_overview IS
  'Trade requests + nombre de proyecto. Consumida por GET /trades.';

-- ============================================================
-- INSERT en applied_migrations
-- ============================================================
INSERT INTO applied_migrations (filename, applied_by, notes) VALUES (
  '052_api_views.sql',
  'X5-api-contract',
  'Crea 7 VIEWS SQL para API: v_project_summary, v_project_detail, v_timeline, v_agent_runs, v_alerts, v_dashboard_metrics, v_trade_overview. Refinadas vs .draft (corregido trade_requests, eliminadas columnas inexistentes en agent_executions).'
);

COMMIT;

-- Verificacion (esperado: 7 filas)
SELECT count(*) AS views_creadas FROM pg_views
WHERE schemaname = 'public' AND viewname IN
  ('v_project_summary','v_project_detail','v_timeline','v_agent_runs',
   'v_alerts','v_dashboard_metrics','v_trade_overview');
