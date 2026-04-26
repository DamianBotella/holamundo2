-- Migration 035: tracking centralizado de llamadas LLM
-- Fecha: 2026-04-26
--
-- Tabla `llm_calls` que registra cada llamada al LLM (vía util_llm_call)
-- con tokens, coste y latencia. Permite:
-- - Dashboard de coste mensual por proyecto y por agente.
-- - Detectar agentes que disparan retries innecesarios.
-- - Predecir el coste por fase de un proyecto futuro.
--
-- La tabla cae a cascada con projects pero sobrevive a la baja del proyecto
-- (ON DELETE SET NULL en project_id) — los costos historicos se preservan
-- para metricas anuales aunque el proyecto desaparezca.

CREATE TABLE IF NOT EXISTS llm_calls (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  agent_name    text NOT NULL,
  project_id    uuid REFERENCES projects(id) ON DELETE SET NULL,
  model         text NOT NULL,
  tokens_in     integer,
  tokens_out    integer,
  cost_usd      numeric(10,6),
  latency_ms    integer,
  status        text NOT NULL DEFAULT 'ok' CHECK (status IN ('ok','error','timeout','rate_limited')),
  error_message text
);

CREATE INDEX IF NOT EXISTS idx_llm_calls_occurred  ON llm_calls (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_calls_agent     ON llm_calls (agent_name, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_calls_project   ON llm_calls (project_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_calls_status    ON llm_calls (status, occurred_at DESC) WHERE status <> 'ok';

-- Helper: registra una llamada LLM. Devuelve el id del registro.
CREATE OR REPLACE FUNCTION log_llm_call(
  p_agent_name text,
  p_project_id uuid,
  p_model text,
  p_tokens_in integer,
  p_tokens_out integer,
  p_cost_usd numeric,
  p_latency_ms integer,
  p_status text DEFAULT 'ok',
  p_error_message text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql AS $body$
DECLARE v_id uuid;
BEGIN
  INSERT INTO llm_calls (agent_name, project_id, model, tokens_in, tokens_out, cost_usd, latency_ms, status, error_message)
  VALUES (p_agent_name, p_project_id, p_model, p_tokens_in, p_tokens_out, p_cost_usd, p_latency_ms, p_status, p_error_message)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$body$;

-- Vista helper: gasto y latencia por agente en los ultimos 30 dias.
CREATE OR REPLACE VIEW llm_costs_summary AS
SELECT
  agent_name,
  count(*) AS calls_total,
  count(*) FILTER (WHERE status = 'ok') AS calls_ok,
  count(*) FILTER (WHERE status <> 'ok') AS calls_error,
  round(coalesce(sum(cost_usd), 0)::numeric, 4) AS cost_usd_total,
  round(coalesce(avg(cost_usd), 0)::numeric, 6) AS cost_usd_avg,
  round(coalesce(avg(latency_ms), 0)::numeric, 0) AS latency_ms_avg,
  coalesce(sum(tokens_in), 0)  AS tokens_in_total,
  coalesce(sum(tokens_out), 0) AS tokens_out_total,
  max(occurred_at) AS last_call_at
FROM llm_calls
WHERE occurred_at > now() - INTERVAL '30 days'
GROUP BY agent_name
ORDER BY cost_usd_total DESC;

-- Verificacion (manual):
-- SELECT log_llm_call('test_agent', NULL, 'gpt-4o', 100, 50, 0.0015, 800, 'ok', NULL);
-- SELECT * FROM llm_costs_summary;
-- DELETE FROM llm_calls WHERE agent_name = 'test_agent';
