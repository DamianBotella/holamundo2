-- 076: ArquitAI Fase D.3 - propuesta con moodboard + render + aceptacion online
-- Extiende proposals para soportar:
--   * moodboard_data: paleta + materiales seleccionados + style rationale (lo escribe agent_proposal_moodboard)
--   * render_data: render generado por mnml.ai (lo escribe agent_proposal_render)
--   * public_token: enlace publico para que el cliente acepte/rechace sin login
--   * accepted_at / accepted_via: rastro de cuando y como acepto
-- Crea proposal_acceptances: log inmutable de cada decision (acceptance/rejection/revision)
-- Almacena la API key de mnml.ai en system_config (no hardcodear en workflow JSON)

BEGIN;

-- 1. Columnas nuevas en proposals
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS moodboard_data            jsonb,
  ADD COLUMN IF NOT EXISTS render_data               jsonb,
  ADD COLUMN IF NOT EXISTS public_token              text,
  ADD COLUMN IF NOT EXISTS public_token_expires_at   timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_at               timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_via              text
    CHECK (accepted_via IS NULL OR accepted_via IN ('public_link','email','signed_pdf','in_person','other')),
  ADD COLUMN IF NOT EXISTS accepted_metadata         jsonb;

-- public_token unico (uno por proposal). Indice parcial: solo cuando hay token.
CREATE UNIQUE INDEX IF NOT EXISTS idx_proposals_public_token
  ON proposals (public_token) WHERE public_token IS NOT NULL;

-- 2. Tabla proposal_acceptances (log de decisiones del cliente, inmutable)
CREATE TABLE IF NOT EXISTS proposal_acceptances (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id   uuid NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  decision      text NOT NULL CHECK (decision IN ('accepted','rejected','revision_requested')),
  signer_name   text,
  signer_email  text,
  comments      text,
  ip_address    text,
  user_agent    text,
  metadata      jsonb,
  decided_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proposal_acceptances_proposal
  ON proposal_acceptances (proposal_id, decided_at DESC);

ALTER TABLE proposal_acceptances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS proposal_acceptances_tenant ON proposal_acceptances;
CREATE POLICY proposal_acceptances_tenant ON proposal_acceptances
  FOR ALL
  USING (tenant_id = current_tenant_id() OR is_super_admin())
  WITH CHECK (tenant_id = current_tenant_id() OR is_super_admin());

-- Solo INSERT permitido (no UPDATE/DELETE) - registro inmutable de auditoria
DROP POLICY IF EXISTS proposal_acceptances_no_update ON proposal_acceptances;
CREATE POLICY proposal_acceptances_no_update ON proposal_acceptances
  FOR UPDATE TO PUBLIC USING (false);

-- 3. API key mnml.ai en system_config
INSERT INTO system_config (key, value, description) VALUES
  ('mnml_api_key',
   'mk_87a60b4bfb8171a3f50aa81914fb95d4f5c80b9a0139e660f85d55729c648df2',
   'API key de mnml.ai para Interior AI rendering (Authorization: Bearer ...)')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

INSERT INTO system_config (key, value, description) VALUES
  ('public_proposal_base_url',
   'https://arquitai.studio/p',
   'Base URL para enlaces publicos de aceptacion de propuestas. Se concatena /<public_token>')
ON CONFLICT (key) DO NOTHING;

-- 4. Tracking en applied_migrations
INSERT INTO applied_migrations (filename, notes) VALUES
  ('076_proposal_visual_acceptance.sql',
   'D.3 plan Opus: moodboard + render mnml.ai + aceptacion online por enlace publico')
ON CONFLICT (filename) DO NOTHING;

COMMIT;

-- rollback:
-- BEGIN;
-- DROP TABLE IF EXISTS proposal_acceptances;
-- ALTER TABLE proposals
--   DROP COLUMN IF EXISTS moodboard_data,
--   DROP COLUMN IF EXISTS render_data,
--   DROP COLUMN IF EXISTS public_token,
--   DROP COLUMN IF EXISTS public_token_expires_at,
--   DROP COLUMN IF EXISTS accepted_at,
--   DROP COLUMN IF EXISTS accepted_via,
--   DROP COLUMN IF EXISTS accepted_metadata;
-- DROP INDEX IF EXISTS idx_proposals_public_token;
-- DELETE FROM system_config WHERE key IN ('mnml_api_key','public_proposal_base_url');
-- DELETE FROM applied_migrations WHERE filename = '076_proposal_visual_acceptance.sql';
-- COMMIT;
