-- 090: PLAN V1.0 Bloque 7 - Schema para los 3 agentes de ejecucion V1.0
-- (agent_acta_obra, agent_incident_handler, agent_client_update).
--
-- 3 tablas nuevas con multi-tenant (RLS + tenant_id obligatorio).
-- Idempotente: usa IF NOT EXISTS + DROP POLICY IF EXISTS.

BEGIN;

-- ============================================================
-- 1. site_visit_acts - Actas de obra (audio + fotos -> PDF firmado)
-- ============================================================
CREATE TABLE IF NOT EXISTS site_visit_acts (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id                 uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  visit_date                 timestamptz NOT NULL DEFAULT now(),
  audio_url                  text,                     -- URL Drive del audio original
  audio_duration_seconds     integer,
  transcript_raw             text,                     -- Output Whisper crudo
  transcript_categorized     jsonb,                    -- { observaciones: [{ gremio, texto, tipo, fotos_referenciadas }] }
  observations               jsonb,                    -- Procesado final tras cruce con planning
  photos                     jsonb,                    -- [{ url, caption?, geo? }]
  acuerdos                   text,
  proxima_visita_prevista    timestamptz,
  pdf_url                    text,                     -- URL Drive del PDF generado
  status                     text NOT NULL DEFAULT 'draft'
                             CHECK (status IN ('draft','approved','signed')),
  approved_by                uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at                timestamptz,
  signed_at                  timestamptz,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_visit_acts_project
  ON site_visit_acts(project_id, visit_date DESC);
CREATE INDEX IF NOT EXISTS idx_site_visit_acts_tenant_status
  ON site_visit_acts(tenant_id, status)
  WHERE status IN ('draft','approved');

ALTER TABLE site_visit_acts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_site_visit_acts ON site_visit_acts;
CREATE POLICY tenant_isolation_site_visit_acts ON site_visit_acts
  FOR ALL
  USING (tenant_id = current_tenant_id() OR is_super_admin())
  WITH CHECK (tenant_id = current_tenant_id() OR is_super_admin());

-- ============================================================
-- 2. project_incidents - Imprevistos detectados en obra
-- ============================================================
CREATE TABLE IF NOT EXISTS project_incidents (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id                      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  detected_at                     timestamptz NOT NULL DEFAULT now(),
  description                     text NOT NULL,
  location                        text,                  -- "bano principal", "pared este salon", etc.
  severity                        text CHECK (severity IN ('baja','media','alta','critica')),
  causa_probable                  text,                  -- Inferido por LLM vision
  options                         jsonb,                 -- [{ descripcion, materiales, coste_eur, dias, ventajas[], desventajas[] }]
  selected_option_index           integer,
  cost_delta_eur                  numeric(12,2),
  time_delta_days                 integer,
  client_communication_draft      text,                  -- Borrador email/whatsapp al cliente
  client_communication_sent_at    timestamptz,
  modification_doc_url            text,                  -- URL Drive del modificado de obra
  status                          text NOT NULL DEFAULT 'detected'
                                  CHECK (status IN ('detected','proposed','communicated','approved','rejected','closed')),
  photos                          jsonb,                 -- [{ url, caption? }]
  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_incidents_project
  ON project_incidents(project_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_incidents_tenant_status
  ON project_incidents(tenant_id, status)
  WHERE status IN ('detected','proposed','communicated','approved');

ALTER TABLE project_incidents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_project_incidents ON project_incidents;
CREATE POLICY tenant_isolation_project_incidents ON project_incidents
  FOR ALL
  USING (tenant_id = current_tenant_id() OR is_super_admin())
  WITH CHECK (tenant_id = current_tenant_id() OR is_super_admin());

-- ============================================================
-- 3. client_weekly_updates - Resumen semanal automatizado al cliente
-- ============================================================
CREATE TABLE IF NOT EXISTS client_weekly_updates (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id               uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  week_start               date NOT NULL,
  week_end                 date NOT NULL,
  summary_text             text,                       -- Texto profesional 150-200 palabras al cliente
  photos_referenced        jsonb,                      -- URLs fotos mas relevantes de la semana
  status                   text NOT NULL DEFAULT 'draft'
                           CHECK (status IN ('draft','approved','sent','failed')),
  approved_by              uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at              timestamptz,
  sent_at                  timestamptz,
  email_message_id         text,                       -- Tracking del email enviado
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_client_weekly_updates_project_week
  ON client_weekly_updates(project_id, week_start);
CREATE INDEX IF NOT EXISTS idx_client_weekly_updates_tenant_status
  ON client_weekly_updates(tenant_id, status, week_start DESC);

ALTER TABLE client_weekly_updates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_client_weekly_updates ON client_weekly_updates;
CREATE POLICY tenant_isolation_client_weekly_updates ON client_weekly_updates
  FOR ALL
  USING (tenant_id = current_tenant_id() OR is_super_admin())
  WITH CHECK (tenant_id = current_tenant_id() OR is_super_admin());

-- ============================================================
-- Triggers updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_site_visit_acts_updated_at ON site_visit_acts;
CREATE TRIGGER trg_site_visit_acts_updated_at
  BEFORE UPDATE ON site_visit_acts
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

DROP TRIGGER IF EXISTS trg_project_incidents_updated_at ON project_incidents;
CREATE TRIGGER trg_project_incidents_updated_at
  BEFORE UPDATE ON project_incidents
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- ============================================================
-- Registro
-- ============================================================
INSERT INTO applied_migrations (filename, notes) VALUES (
  '090_execution_agents_schema.sql',
  'PLAN V1 Bloque 7: tablas site_visit_acts + project_incidents + client_weekly_updates con RLS y triggers updated_at para los 3 agentes V1.0 (acta_obra, incident_handler, client_update)'
) ON CONFLICT (filename) DO NOTHING;

COMMIT;

-- ============================================================
-- Verificacion
-- ============================================================
-- SELECT table_name FROM information_schema.tables
--  WHERE table_schema='public'
--    AND table_name IN ('site_visit_acts','project_incidents','client_weekly_updates');
-- expected: 3 filas
--
-- SELECT tablename, policyname FROM pg_policies
--  WHERE tablename IN ('site_visit_acts','project_incidents','client_weekly_updates');
-- expected: 3 policies (una por tabla)

-- ============================================================
-- Rollback
-- ============================================================
-- BEGIN;
-- DROP TRIGGER IF EXISTS trg_project_incidents_updated_at ON project_incidents;
-- DROP TRIGGER IF EXISTS trg_site_visit_acts_updated_at ON site_visit_acts;
-- DROP TABLE IF EXISTS client_weekly_updates;
-- DROP TABLE IF EXISTS project_incidents;
-- DROP TABLE IF EXISTS site_visit_acts;
-- DELETE FROM applied_migrations WHERE filename='090_execution_agents_schema.sql';
-- COMMIT;
