-- 083: ArquitAI Fase G+ - Plan founder + infra de alertas pre-expiracion de trial
-- Crea:
--   1. Plan "founder": 0 EUR, limits unlimited, sin trial. Para uso interno (Damian + futuros co-founders).
--   2. Tabla trial_alerts_sent: registro de emails enviados para no spammear (idempotencia).
--   3. Helper find_expiring_trials(days_array): SELECT subs cuyo trial vence en N dias.
--   4. Mueve damian-mtnz a plan founder con status='active' (sin trial).

BEGIN;

-- 1. PRIMERO relajar el CHECK de tier_slug (necesario antes del INSERT de founder)
ALTER TABLE subscription_plans DROP CONSTRAINT IF EXISTS subscription_plans_tier_slug_check;
ALTER TABLE subscription_plans ADD CONSTRAINT subscription_plans_tier_slug_check
  CHECK (tier_slug IN ('starter','pro','equipo','founder'));

-- 2. Plan founder (oculto del catalogo publico, is_active=false significa "no se vende")
INSERT INTO subscription_plans (tier_slug, name, description, price_eur_monthly, stripe_price_id, features, limits, trial_days, sort_order, is_active) VALUES
('founder','Founder','Plan interno para fundador y equipo core. No se vende. Sin trial. Acceso total ilimitado a la plataforma.',
 0.00,
 NULL,
 '["todos_agentes","precheck_normativa_top5_plus","propuesta_visual_premium","render_mnml_unlimited","cliente_translator","decision_engine","memoria_proyectos","integracion_drive_gmail","multi_arquitecto","onboarding_dedicado","sso_saml","webhook_alertas_custom","internal_metrics_access"]'::jsonb,
 '{"max_projects": -1, "max_users": -1, "max_ai_tokens": -1, "max_agents": -1, "max_agent_executions": -1, "render_mnml_per_month": -1, "support": "internal"}'::jsonb,
 0, 99, false)
ON CONFLICT (tier_slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  features = EXCLUDED.features,
  limits = EXCLUDED.limits,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- 2. Tabla de log de alertas enviadas (idempotencia: NO spammear)
CREATE TABLE IF NOT EXISTS trial_alerts_sent (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subscription_id      uuid REFERENCES tenant_subscriptions(id) ON DELETE CASCADE,
  alert_type           text NOT NULL CHECK (alert_type IN ('7d','3d','1d','will_end_stripe','trial_ended')),
  alert_window_date    date NOT NULL,
  email_to             text,
  sent_at              timestamptz NOT NULL DEFAULT now(),
  metadata             jsonb DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, alert_type, alert_window_date)
);

CREATE INDEX IF NOT EXISTS idx_trial_alerts_tenant ON trial_alerts_sent(tenant_id, sent_at DESC);

ALTER TABLE trial_alerts_sent ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS trial_alerts_tenant ON trial_alerts_sent;
CREATE POLICY trial_alerts_tenant ON trial_alerts_sent
  FOR ALL
  USING (tenant_id = current_tenant_id() OR is_super_admin())
  WITH CHECK (tenant_id = current_tenant_id() OR is_super_admin());

-- 3. Helper SQL: find_expiring_trials() devuelve subs por vencer
CREATE OR REPLACE FUNCTION find_expiring_trials()
RETURNS TABLE(
  tenant_id            uuid,
  tenant_name          text,
  tenant_slug          text,
  contact_email        text,
  subscription_id      uuid,
  plan_tier            text,
  trial_ends_at        timestamptz,
  days_until_expiry    int,
  alert_window         text,
  already_sent         boolean
) LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  WITH expiring AS (
    SELECT
      ts.tenant_id,
      t.name AS tenant_name,
      t.slug AS tenant_slug,
      t.contact_email,
      ts.id AS subscription_id,
      sp.tier_slug AS plan_tier,
      ts.trial_ends_at,
      EXTRACT(DAY FROM ts.trial_ends_at - now())::int AS days_until_expiry,
      CASE
        WHEN ts.trial_ends_at <= now() + interval '1 day' THEN '1d'
        WHEN ts.trial_ends_at <= now() + interval '3 days' THEN '3d'
        WHEN ts.trial_ends_at <= now() + interval '7 days' THEN '7d'
      END AS alert_window
    FROM tenant_subscriptions ts
    JOIN tenants t ON t.id = ts.tenant_id
    JOIN subscription_plans sp ON sp.id = ts.plan_id
    WHERE ts.status = 'trialing'
      AND ts.trial_ends_at IS NOT NULL
      AND ts.trial_ends_at <= now() + interval '7 days'
      AND ts.trial_ends_at > now()
      AND sp.tier_slug <> 'founder'  -- founder no tiene trial, salta
  )
  SELECT
    e.tenant_id,
    e.tenant_name,
    e.tenant_slug,
    e.contact_email,
    e.subscription_id,
    e.plan_tier,
    e.trial_ends_at,
    e.days_until_expiry,
    e.alert_window,
    EXISTS(
      SELECT 1 FROM trial_alerts_sent tas
      WHERE tas.tenant_id = e.tenant_id
        AND tas.alert_type = e.alert_window
        AND tas.alert_window_date = e.trial_ends_at::date
    ) AS already_sent
  FROM expiring e
  WHERE e.alert_window IS NOT NULL
  ORDER BY e.trial_ends_at ASC;
END;
$$;

-- 4. Mover damian-mtnz al plan founder con status='active' (sin trial)
UPDATE tenant_subscriptions ts
SET plan_id = (SELECT id FROM subscription_plans WHERE tier_slug = 'founder' LIMIT 1),
    status = 'active',
    trial_started_at = NULL,
    trial_ends_at = NULL,
    cancel_at_period_end = false,
    canceled_at = NULL,
    ended_at = NULL,
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'is_founder', true,
      'promoted_from', 'pro_trial',
      'promoted_at', now()::text,
      'reason', 'Internal use - founder account exempt from billing'
    ),
    updated_at = now()
WHERE ts.tenant_id = (SELECT id FROM tenants WHERE slug = 'damian-mtnz' LIMIT 1);

-- 5. Tracking
INSERT INTO applied_migrations (filename, notes) VALUES
  ('083_founder_plan_plus_trial_alert.sql', 'G+ plan Opus: plan founder (unlimited, no trial) + tabla trial_alerts_sent + funcion find_expiring_trials. damian-mtnz movido a founder/active.')
ON CONFLICT (filename) DO NOTHING;

COMMIT;

-- Verificacion post-aplicacion:
-- SELECT get_tenant_billing_state((SELECT id FROM tenants WHERE slug='damian-mtnz'));
-- esperado: tier=founder, status=active, trial_ends_at=null, limits.max_projects=-1
-- SELECT * FROM find_expiring_trials();  -- esperado: vacio (damian es founder, no entra)

-- rollback:
-- BEGIN;
-- DROP FUNCTION IF EXISTS find_expiring_trials();
-- DROP TABLE IF EXISTS trial_alerts_sent;
-- UPDATE tenant_subscriptions SET plan_id = (SELECT id FROM subscription_plans WHERE tier_slug='pro' LIMIT 1), status='trialing', trial_started_at=now(), trial_ends_at=now()+interval '14 days' WHERE tenant_id=(SELECT id FROM tenants WHERE slug='damian-mtnz');
-- ALTER TABLE subscription_plans DROP CONSTRAINT IF EXISTS subscription_plans_tier_slug_check;
-- ALTER TABLE subscription_plans ADD CONSTRAINT subscription_plans_tier_slug_check CHECK (tier_slug IN ('starter','pro','equipo'));
-- DELETE FROM subscription_plans WHERE tier_slug='founder';
-- DELETE FROM applied_migrations WHERE filename='083_founder_plan_plus_trial_alert.sql';
-- COMMIT;
