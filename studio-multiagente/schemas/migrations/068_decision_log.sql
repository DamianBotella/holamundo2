-- 068: decision_log (Fase A.2 plan Opus, original 027)
-- Registro inmutable de decisiones tomadas (por arquitecto/cliente/sistema/agentes).
-- Lo escribe agent_decision_engine en Fase D.

BEGIN;

CREATE TABLE IF NOT EXISTS decision_log (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  decision_origen     text NOT NULL CHECK (decision_origen IN ('arquitecto','cliente','sistema','agente')),
  agente_recomendador text,
  opciones_evaluadas  jsonb NOT NULL,
  opcion_elegida      jsonb NOT NULL,
  criterios_decision  jsonb,
  justificacion       text,
  impacto_economico   numeric(12,2),
  impacto_normativo   text,
  impacto_energetico  text,
  decided_at          timestamptz DEFAULT now(),
  decided_by          uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_decision_project
  ON decision_log(project_id, decided_at DESC);
CREATE INDEX IF NOT EXISTS idx_decision_tenant
  ON decision_log(tenant_id, decided_at DESC);

ALTER TABLE decision_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS decision_tenant ON decision_log;
CREATE POLICY decision_tenant ON decision_log
  FOR ALL
  USING (tenant_id = current_tenant_id() OR is_super_admin())
  WITH CHECK (tenant_id = current_tenant_id() OR is_super_admin());

INSERT INTO applied_migrations (filename, notes) VALUES
  ('068_decision_log.sql', 'A.2 plan Opus (originalmente 027): log inmutable de decisiones (Fase D agent_decision_engine)')
ON CONFLICT (filename) DO NOTHING;

COMMIT;

-- rollback: DROP POLICY IF EXISTS decision_tenant ON decision_log; DROP TABLE IF EXISTS decision_log; DELETE FROM applied_migrations WHERE filename = '068_decision_log.sql';
