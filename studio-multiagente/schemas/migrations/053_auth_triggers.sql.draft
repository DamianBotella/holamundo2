-- Migration 053: Auth triggers + custom_access_token_hook + pending_invitations
-- Fecha planificada: X4 (auth)
-- Estado: DRAFT - aplicar tras 051 + tras configurar Supabase Auth.
--
-- Crea:
--   - Tabla pending_invitations
--   - Trigger en auth.users INSERT que crea user_profiles
--   - Function custom_access_token_hook que inyecta tenant_id + role en JWT
--
-- IMPORTANTE: tras aplicar, hay que registrar el hook en Supabase:
--   Dashboard -> Authentication -> Hooks -> Custom Access Token
--   Function: public.custom_access_token_hook

BEGIN;

-- ============================================================
-- 1. pending_invitations - emails invitados pendientes de aceptar
-- ============================================================
CREATE TABLE IF NOT EXISTS pending_invitations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL,
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  role        text NOT NULL DEFAULT 'architect'
              CHECK (role IN ('architect', 'colaborador', 'super_admin')),
  invited_by  uuid,  -- user_id del que invita (no FK porque auth.users cross-schema)
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  consumed_at timestamptz,
  metadata    jsonb DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pending_invitations_email
  ON pending_invitations (lower(email))
  WHERE consumed_at IS NULL;

CREATE INDEX idx_pending_invitations_tenant
  ON pending_invitations (tenant_id);

COMMENT ON TABLE pending_invitations IS
  'Invitaciones pendientes. Cuando un usuario acepta el magic link de Supabase y crea cuenta, el trigger on_auth_user_created busca la invitacion correspondiente y crea su user_profiles con el tenant_id correcto.';

-- ============================================================
-- 2. Trigger on_auth_user_created - crea user_profiles automatico
-- ============================================================
CREATE OR REPLACE FUNCTION public.on_auth_user_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  inv pending_invitations;
  default_tenant uuid;
BEGIN
  SELECT * INTO inv
    FROM pending_invitations
   WHERE lower(email) = lower(NEW.email)
     AND consumed_at IS NULL
     AND expires_at > now()
   ORDER BY created_at DESC
   LIMIT 1;

  IF FOUND THEN
    INSERT INTO public.user_profiles (user_id, tenant_id, role, full_name, email)
    VALUES (
      NEW.id,
      inv.tenant_id,
      inv.role,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      NEW.email
    )
    ON CONFLICT (user_id) DO NOTHING;

    UPDATE pending_invitations SET consumed_at = now() WHERE id = inv.id;
  ELSE
    -- Sin invitacion: en MVP lo aceptamos y creamos en tenant baseline.
    -- En produccion se cambiaria por: RAISE EXCEPTION 'No active invitation for %', NEW.email;
    SELECT id INTO default_tenant FROM tenants WHERE slug='damian-mtnz' LIMIT 1;
    INSERT INTO public.user_profiles (user_id, tenant_id, role, full_name, email)
    VALUES (
      NEW.id,
      default_tenant,
      'architect',
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      NEW.email
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- No bloqueamos el login si falla esto - log y seguir
  -- (housekeeping cron reconcilia despues).
  -- Necesita activity_log permite project_id NULL para esto:
  INSERT INTO activity_log (project_id, agent_name, action, status, output_summary, details)
  VALUES (
    NULL,
    'auth_trigger',
    'user_profile_creation_failed',
    'failed',
    'Error creando user_profile en signup',
    jsonb_build_object('user_id', NEW.id::text, 'email', NEW.email, 'error', SQLERRM)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auth_user_created ON auth.users;
CREATE TRIGGER trg_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.on_auth_user_created();

COMMENT ON FUNCTION public.on_auth_user_created IS
  'Tras INSERT en auth.users, crea user_profiles correspondiente. Busca invitacion pendiente por email, sino usa tenant baseline. SECURITY DEFINER porque escribe en public.user_profiles.';

-- ============================================================
-- 3. custom_access_token_hook - inyecta tenant_id + role en JWT
-- ============================================================
-- Esta funcion se llama por Supabase Auth en cada login + refresh.
-- El payload original contiene { user_id, claims:{...} }.
-- Devolvemos el mismo payload con claims modificadas.

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE
  claims    jsonb;
  user_uuid uuid;
  profile   record;
BEGIN
  user_uuid := (event->>'user_id')::uuid;
  claims    := event->'claims';

  SELECT tenant_id, role, full_name, active
    INTO profile
    FROM public.user_profiles
   WHERE user_profiles.user_id = user_uuid
   LIMIT 1;

  IF NOT FOUND THEN
    -- Usuario sin perfil: dejamos el JWT sin custom claims pero permitimos login.
    -- Los workflows api_* rechazaran por falta de tenant_id.
    RETURN event;
  END IF;

  IF NOT profile.active THEN
    -- Usuario inactivo: no inyectamos claims (api_* rechazara).
    RETURN event;
  END IF;

  claims := jsonb_set(claims, '{tenant_id}', to_jsonb(profile.tenant_id::text));
  claims := jsonb_set(claims, '{role}',      to_jsonb(profile.role));
  IF profile.full_name IS NOT NULL THEN
    claims := jsonb_set(claims, '{full_name}', to_jsonb(profile.full_name));
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

COMMENT ON FUNCTION public.custom_access_token_hook IS
  'Auth Hook de Supabase. Se invoca en login + refresh. Inyecta tenant_id, role y full_name como custom claims firmados en el JWT. Registrar en Supabase Dashboard -> Authentication -> Hooks.';

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO authenticated;

-- ============================================================
-- 4. Helper: validar que un user_id tiene perfil activo
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_user_active(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
     WHERE user_id = p_user_id AND active = true
  );
$$;

-- ============================================================
-- INSERT en applied_migrations
-- ============================================================
INSERT INTO applied_migrations (filename, applied_by, notes) VALUES (
  '053_auth_triggers.sql',
  'X4-auth',
  'Crea pending_invitations + trigger on_auth_user_created (auto-crea user_profiles tras signup) + custom_access_token_hook (inyecta tenant_id, role, full_name en JWT). REGISTRAR HOOK MANUALMENTE EN SUPABASE DASHBOARD tras aplicar.'
);

COMMIT;
