-- 067: roi_metrics (Fase A.2 plan Opus, original 026)
-- KPIs por proyecto: coste real vs presupuestado, plazo, satisfaccion, margen, etc.

BEGIN;

CREATE TABLE IF NOT EXISTS roi_metrics (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id               uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id                uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  coste_real               numeric(12,2),
  coste_presupuestado      numeric(12,2),
  desviacion_porcentaje    numeric(7,2) GENERATED ALWAYS AS
    (CASE WHEN coste_presupuestado IS NOT NULL AND coste_presupuestado > 0
          THEN ((coste_real - coste_presupuestado) / coste_presupuestado) * 100
          ELSE NULL END) STORED,
  tiempo_real_dias         integer,
  tiempo_previsto_dias     integer,
  satisfaccion_cliente     integer CHECK (satisfaccion_cliente BETWEEN 1 AND 5),
  margen_estudio_eur       numeric(12,2),
  horas_arquitecto         numeric(8,2),
  ahorro_subvenciones_eur  numeric(12,2),
  notas                    text,
  updated_at               timestamptz DEFAULT now(),
  UNIQUE (project_id)
);

CREATE INDEX IF NOT EXISTS idx_roi_tenant ON roi_metrics(tenant_id);

ALTER TABLE roi_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS roi_tenant ON roi_metrics;
CREATE POLICY roi_tenant ON roi_metrics
  FOR ALL
  USING (tenant_id = current_tenant_id() OR is_super_admin())
  WITH CHECK (tenant_id = current_tenant_id() OR is_super_admin());

INSERT INTO applied_migrations (filename, notes) VALUES
  ('067_roi_metrics.sql', 'A.2 plan Opus (originalmente 026): KPIs por proyecto con desviacion calculada')
ON CONFLICT (filename) DO NOTHING;

COMMIT;

-- rollback: DROP POLICY IF EXISTS roi_tenant ON roi_metrics; DROP TABLE IF EXISTS roi_metrics; DELETE FROM applied_migrations WHERE filename = '067_roi_metrics.sql';
