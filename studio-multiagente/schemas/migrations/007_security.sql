-- Migration 007: bloque seguridad (mínimo viable antes de aceptar cliente real)
-- Fecha: 2026-04-25
--
-- Cambios:
--  1. Tabla `system_config` con la API key de webhooks expuestos.
--  2. Tabla `consent_records` para registro RGPD/LOPDGDD.
--  3. Función `anonymize_client(uuid)` para "derecho al olvido".
--  4. Columna `webhook_token` en `proposals` (existía ya en `approvals`).

-- ============================================================
-- 1) Configuración del sistema (incluye API key de webhooks)
-- ============================================================
CREATE TABLE IF NOT EXISTS system_config (
  key         text PRIMARY KEY,
  value       text NOT NULL,
  description text,
  updated_at  timestamptz DEFAULT now()
);

-- API key generada aleatoriamente. La credencial httpHeaderAuth en n8n
-- ("Webhook API Key (entrante)", id Ba643jvuElTgMawr) usa este valor.
INSERT INTO system_config (key, value, description) VALUES
  ('webhook_api_key',
   'arquitai-' || encode(gen_random_bytes(24), 'base64'),
   'API key requerida en cabecera X-API-Key para webhooks expuestos a internet')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 2) Registro de consentimientos (RGPD art. 7)
-- ============================================================
CREATE TABLE IF NOT EXISTS consent_records (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     uuid REFERENCES clients(id) ON DELETE CASCADE,
  project_id    uuid REFERENCES projects(id) ON DELETE SET NULL,
  consent_type  text NOT NULL
                  CHECK (consent_type IN ('data_processing','marketing',
                                          'project_sharing','third_party_communication')),
  granted       boolean NOT NULL,
  granted_at    timestamptz NOT NULL DEFAULT now(),
  revoked_at    timestamptz,
  source        text NOT NULL DEFAULT 'architect_intake'
                  CHECK (source IN ('architect_intake','client_signed_form',
                                    'phone_recorded','email_confirmation','other')),
  evidence_text text,
  evidence_url  text,
  notes         text
);

CREATE INDEX IF NOT EXISTS idx_consent_records_client ON consent_records (client_id);

-- ============================================================
-- 3) Función para "derecho al olvido" (RGPD art. 17)
-- ============================================================
CREATE OR REPLACE FUNCTION anonymize_client(p_client_id uuid)
RETURNS json
LANGUAGE plpgsql
AS $body$
DECLARE
  v_count integer;
BEGIN
  -- Anonimizar la fila del cliente
  UPDATE clients
  SET name  = 'ANONIMIZADO-' || substring(id::text, 1, 8),
      email = 'anon-' || substring(id::text, 1, 8) || '@anonymized.local',
      phone = NULL,
      notes = '[ANONIMIZADO POR DERECHO AL OLVIDO]'
  WHERE id = p_client_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Limpiar metadatos sensibles del proyecto
  UPDATE projects
  SET metadata = metadata
                 - 'architect_intake_notes'
                 - 'architect_observations'
                 - 'client_stated_preferences'
  WHERE client_id = p_client_id;

  -- Anonimizar briefings asociados
  UPDATE briefings
  SET client_needs      = '[]'::jsonb,
      style_preferences = '{}'::jsonb,
      summary           = '[ANONIMIZADO]'
  WHERE project_id IN (SELECT id FROM projects WHERE client_id = p_client_id);

  -- Registro de la operación en consent_records
  INSERT INTO consent_records (client_id, consent_type, granted, source, notes)
  VALUES (p_client_id, 'data_processing', false, 'other',
          'Anonymized via anonymize_client() at ' || now()::text);

  RETURN json_build_object(
    'client_id',     p_client_id,
    'clients_updated', v_count,
    'anonymized_at', now()
  );
END;
$body$;

-- ============================================================
-- 4) Token de webhook en proposals (paridad con `approvals.webhook_token`)
-- ============================================================
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS webhook_token text;

-- ============================================================
-- Verificación post-migración
-- ============================================================
-- SELECT key, description FROM system_config;
-- SELECT proname FROM pg_proc WHERE proname = 'anonymize_client';
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'proposals' AND column_name = 'webhook_token';

-- ============================================================
-- Uso del derecho al olvido
-- ============================================================
-- SELECT anonymize_client('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'::uuid);
