-- 088: ADDENDUM 2 Bloque 7: vistas para Dashboard de Inteligencia de Negocio.
--
-- Cada vista mapea a las columnas REALES del esquema (los nombres en el
-- documento del ADDENDUM eran orientativos). NO creamos columnas nuevas
-- para "encajar" la vista; mapeamos a lo que existe.
--
-- Mapeos aplicados:
--   roi_metrics.coste_presupuestado  -> proxy de "honorarios_total"
--   roi_metrics.margen_estudio_eur   -> margen_eur
--   proposals.status = 'sent_to_client' -> "enviadas"
--   cost_estimates.budget_target / total_estimated -> presupuesto inicial/actual
--   projects.started_at / target_completion -> ventana del proyecto
--   agent_executions.started_at -> created_at equivalente
--
-- project_phase_history NO existe en este schema. v_bi_phase_duration se
-- crea como placeholder vacio (siempre 0 filas) para que el endpoint
-- /api/v1/bi/dashboard no rompa; cuando se modele el historial de fases
-- la vista se reemplazara.

BEGIN;

-- ============================================================
-- 1. v_bi_project_profitability
--    Rentabilidad por proyecto: margen euros + margen % sobre coste
--    presupuestado.
-- ============================================================
CREATE OR REPLACE VIEW v_bi_project_profitability AS
SELECT
  p.tenant_id,
  p.id           AS project_id,
  p.name         AS project_name,
  p.status,
  rm.coste_presupuestado,
  rm.coste_real,
  rm.horas_arquitecto,
  rm.margen_estudio_eur AS margen_eur,
  CASE
    WHEN rm.coste_presupuestado IS NOT NULL AND rm.coste_presupuestado > 0
      THEN (rm.margen_estudio_eur / rm.coste_presupuestado) * 100
    ELSE NULL
  END AS margen_pct,
  p.created_at,
  p.completed_at
FROM projects p
LEFT JOIN roi_metrics rm ON rm.project_id = p.id;

-- ============================================================
-- 2. v_bi_phase_duration
--    Placeholder. project_phase_history NO existe todavia.
--    Forma compatible para el cliente (phase, dias_medios, n_proyectos)
--    pero siempre 0 filas. Cuando se modele el historial de fases
--    esta vista se sustituye sin tocar frontend.
-- ============================================================
CREATE OR REPLACE VIEW v_bi_phase_duration AS
SELECT
  tenant_id,
  current_phase     AS phase,
  0                 AS n_proyectos,
  0                 AS dias_medios
FROM projects
WHERE FALSE;  -- siempre vacio hasta tener historial de fases

-- ============================================================
-- 3. v_bi_proposal_conversion
--    Tasa de conversion sent_to_client -> accepted por mes.
--    proposals NO tiene tenant_id directo -> JOIN a projects.
-- ============================================================
CREATE OR REPLACE VIEW v_bi_proposal_conversion AS
SELECT
  p.tenant_id,
  date_trunc('month', pr.created_at) AS mes,
  COUNT(*) FILTER (WHERE pr.status IN ('sent_to_client','accepted','rejected')) AS enviadas,
  COUNT(*) FILTER (WHERE pr.status = 'accepted')                                AS aceptadas,
  CASE
    WHEN COUNT(*) FILTER (WHERE pr.status IN ('sent_to_client','accepted','rejected')) > 0
      THEN (COUNT(*) FILTER (WHERE pr.status='accepted')::float /
            COUNT(*) FILTER (WHERE pr.status IN ('sent_to_client','accepted','rejected'))) * 100
    ELSE 0
  END AS tasa_pct
FROM proposals pr
JOIN projects p ON p.id = pr.project_id
GROUP BY p.tenant_id, date_trunc('month', pr.created_at);

-- ============================================================
-- 4. v_bi_agent_activity_month
--    Agentes mas activos en el mes. agent_executions NO tiene
--    tenant_id directo -> JOIN a projects. Usa started_at en lugar
--    de created_at (no existe).
-- ============================================================
CREATE OR REPLACE VIEW v_bi_agent_activity_month AS
SELECT
  p.tenant_id,
  ae.agent_name,
  COUNT(*) AS ejecuciones
FROM agent_executions ae
LEFT JOIN projects p ON p.id = ae.project_id
WHERE ae.started_at >= date_trunc('month', now())
GROUP BY p.tenant_id, ae.agent_name
ORDER BY ejecuciones DESC;

-- ============================================================
-- 5. v_bi_budget_alerts
--    Desviacion presupuestaria > 15 %. cost_estimates NO tiene
--    tenant_id directo -> JOIN a projects.
-- ============================================================
CREATE OR REPLACE VIEW v_bi_budget_alerts AS
SELECT
  p.tenant_id,
  p.id   AS project_id,
  p.name,
  ce.budget_target    AS presupuesto_inicial,
  ce.total_estimated  AS presupuesto_actual,
  CASE
    WHEN ce.budget_target IS NOT NULL AND ce.budget_target > 0
      THEN ((ce.total_estimated - ce.budget_target) / ce.budget_target) * 100
    ELSE NULL
  END AS desviacion_pct
FROM cost_estimates ce
JOIN projects p ON p.id = ce.project_id
WHERE ce.budget_target IS NOT NULL
  AND ce.budget_target > 0
  AND ((ce.total_estimated - ce.budget_target) / ce.budget_target) > 0.15;

-- ============================================================
-- Grants
-- ============================================================
GRANT SELECT ON
  v_bi_project_profitability,
  v_bi_phase_duration,
  v_bi_proposal_conversion,
  v_bi_agent_activity_month,
  v_bi_budget_alerts
TO authenticated;

-- ============================================================
-- Registro de migracion
-- ============================================================
INSERT INTO applied_migrations (filename, notes) VALUES (
  '088_business_intelligence_views.sql',
  'ADDENDUM 2 Bloque 7: 5 vistas BI (profitability, phase_duration placeholder, proposal_conversion, agent_activity_month, budget_alerts) mapeadas a columnas reales'
) ON CONFLICT (filename) DO NOTHING;

COMMIT;

-- ============================================================
-- Verificacion
-- ============================================================
-- SELECT * FROM v_bi_project_profitability LIMIT 5;
-- SELECT * FROM v_bi_phase_duration; -- 0 filas (placeholder)
-- SELECT * FROM v_bi_proposal_conversion ORDER BY mes DESC LIMIT 3;
-- SELECT * FROM v_bi_agent_activity_month LIMIT 5;
-- SELECT * FROM v_bi_budget_alerts;

-- ============================================================
-- Rollback
-- ============================================================
-- BEGIN;
-- DROP VIEW IF EXISTS v_bi_budget_alerts;
-- DROP VIEW IF EXISTS v_bi_agent_activity_month;
-- DROP VIEW IF EXISTS v_bi_proposal_conversion;
-- DROP VIEW IF EXISTS v_bi_phase_duration;
-- DROP VIEW IF EXISTS v_bi_project_profitability;
-- DELETE FROM applied_migrations WHERE filename='088_business_intelligence_views.sql';
-- COMMIT;
