-- Migration 017: client_access_tokens
-- Fecha: 2026-04-25
--
-- Tokens efimeros para que el cliente final acceda a un proyecto sin API key.
-- Casos de uso:
--   - aftercare_submit: cliente reporta incidencia post-entrega via formulario web
--   - project_view: cliente ve resumen de su proyecto
--   - full_access: ambos
--
-- El token es el control de acceso (no requiere auth header). Se valida con
-- la funcion validate_client_token() que comprueba existencia, no revocado,
-- no expirado, purpose correcto, y registra el uso atomicamente.

CREATE TABLE IF NOT EXISTS client_access_tokens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_id     uuid REFERENCES clients(id) ON DELETE SET NULL,
  token         text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(20), 'hex'),
  purpose       text NOT NULL CHECK (purpose IN ('aftercare_submit','project_view','full_access')),
  issued_at     timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz,
  used_count    integer NOT NULL DEFAULT 0,
  last_used_at  timestamptz,
  revoked_at    timestamptz,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_tokens_token   ON client_access_tokens (token);
CREATE INDEX IF NOT EXISTS idx_client_tokens_project ON client_access_tokens (project_id, purpose);
CREATE INDEX IF NOT EXISTS idx_client_tokens_active  ON client_access_tokens (expires_at) WHERE revoked_at IS NULL;

-- Funcion atomic de validacion + tracking
CREATE OR REPLACE FUNCTION validate_client_token(p_token text, p_purpose text)
RETURNS TABLE (project_id uuid, token_id uuid, valid boolean, reason text)
LANGUAGE plpgsql
AS $body$
DECLARE
  v_record record;
BEGIN
  SELECT * INTO v_record FROM client_access_tokens WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, false, 'token_not_found'::text;
    RETURN;
  END IF;
  IF v_record.revoked_at IS NOT NULL THEN
    RETURN QUERY SELECT v_record.project_id, v_record.id, false, 'revoked'::text;
    RETURN;
  END IF;
  IF v_record.expires_at IS NOT NULL AND v_record.expires_at < now() THEN
    RETURN QUERY SELECT v_record.project_id, v_record.id, false, 'expired'::text;
    RETURN;
  END IF;
  IF v_record.purpose NOT IN ('full_access', p_purpose) THEN
    RETURN QUERY SELECT v_record.project_id, v_record.id, false, 'wrong_purpose'::text;
    RETURN;
  END IF;
  -- Token valido: registrar uso
  UPDATE client_access_tokens
     SET used_count = used_count + 1,
         last_used_at = now()
   WHERE id = v_record.id;
  RETURN QUERY SELECT v_record.project_id, v_record.id, true, 'ok'::text;
END;
$body$;

CREATE OR REPLACE FUNCTION touch_client_tokens()
RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$body$;

DROP TRIGGER IF EXISTS client_tokens_touch ON client_access_tokens;
CREATE TRIGGER client_tokens_touch BEFORE UPDATE ON client_access_tokens
  FOR EACH ROW EXECUTE FUNCTION touch_client_tokens();

-- ============================================================
-- Verificacion
-- ============================================================
-- SELECT count(*) FROM information_schema.columns WHERE table_name='client_access_tokens'; -- 13
-- SELECT * FROM validate_client_token('test_invalid', 'aftercare_submit');
--   -> (NULL, NULL, false, token_not_found)
