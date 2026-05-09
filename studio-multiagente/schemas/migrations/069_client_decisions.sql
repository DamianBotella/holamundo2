-- 069: client_decisions (Fase A.2 plan Opus, original 028)
-- Decisiones explicitas del cliente con timestamp para evitar scope creep.
-- Lo escribe agent_client_translator en Fase D.

BEGIN;

CREATE TABLE IF NOT EXISTS client_decisions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id             uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id              uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  decision_tipo          text CHECK (decision_tipo IN (
    'distribucion','material','presupuesto','plazo','acabados','equipamiento','otro'
  )),
  decision_descripcion   text NOT NULL,
  contexto_propuesta     jsonb,
  impacto_economico      numeric(12,2),
  impacto_plazo_dias     integer,
  fecha_decision         timestamptz DEFAULT now(),
  contradicciones        jsonb,
  confirmada_cliente     boolean DEFAULT false,
  metodo_confirmacion    text CHECK (metodo_confirmacion IN ('email','firma_digital','reunion','chat','otro')),
  evidencia_url          text
);

CREATE INDEX IF NOT EXISTS idx_client_dec_project
  ON client_decisions(project_id, fecha_decision DESC);
CREATE INDEX IF NOT EXISTS idx_client_dec_tenant
  ON client_decisions(tenant_id, fecha_decision DESC);

ALTER TABLE client_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_dec_tenant ON client_decisions;
CREATE POLICY client_dec_tenant ON client_decisions
  FOR ALL
  USING (tenant_id = current_tenant_id() OR is_super_admin())
  WITH CHECK (tenant_id = current_tenant_id() OR is_super_admin());

INSERT INTO applied_migrations (filename, notes) VALUES
  ('069_client_decisions.sql', 'A.2 plan Opus (originalmente 028): decisiones cliente con timestamp anti-scope-creep (Fase D)')
ON CONFLICT (filename) DO NOTHING;

COMMIT;

-- rollback: DROP POLICY IF EXISTS client_dec_tenant ON client_decisions; DROP TABLE IF EXISTS client_decisions; DELETE FROM applied_migrations WHERE filename = '069_client_decisions.sql';
