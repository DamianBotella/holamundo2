-- 061: materials_catalog (Fase A.2 plan Opus, original 020)
-- Catalogo de materiales por tenant con embedding semantico para busqueda similitud.

BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS materials_catalog (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sku_fabricante         text,
  nombre                 text NOT NULL,
  marca                  text NOT NULL,
  categoria              text NOT NULL CHECK (categoria IN (
    'ceramica','sanitarios','griferia','carpinteria_interior',
    'carpinteria_exterior','aislamiento','impermeabilizacion',
    'pintura','pavimento','revestimiento','iluminacion',
    'electrodomesticos','climatizacion','fontaneria','electricidad','otros'
  )),
  precio_pvp_eur         numeric(10,2),
  unidad                 text CHECK (unidad IN ('m2','m3','ml','ud','kg','l')),
  fecha_precio           timestamptz,
  fuente_precio          text CHECK (fuente_precio IN ('BIMobject','ACAE','BEDEC','PDF','Newsletter','Manual')),
  url_fabricante         text,
  url_bimobject          text,
  epd_url                text,
  huella_co2_kg          numeric(10,3),
  descripcion            text,
  embedding_descripcion  vector(1536),
  raw_metadata           jsonb,
  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_materials_tenant    ON materials_catalog(tenant_id);
CREATE INDEX IF NOT EXISTS idx_materials_categoria ON materials_catalog(categoria);
CREATE INDEX IF NOT EXISTS idx_materials_marca     ON materials_catalog(marca);
CREATE INDEX IF NOT EXISTS idx_materials_embedding ON materials_catalog
  USING ivfflat (embedding_descripcion vector_cosine_ops) WITH (lists = 100);

ALTER TABLE materials_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS materials_tenant ON materials_catalog;
CREATE POLICY materials_tenant ON materials_catalog
  FOR ALL
  USING (tenant_id = current_tenant_id() OR is_super_admin())
  WITH CHECK (tenant_id = current_tenant_id() OR is_super_admin());

INSERT INTO applied_migrations (filename, notes) VALUES
  ('061_materials_catalog.sql', 'A.2 plan Opus (originalmente 020): catalogo materiales tenant + embedding ivfflat')
ON CONFLICT (filename) DO NOTHING;

COMMIT;

-- rollback: DROP POLICY IF EXISTS materials_tenant ON materials_catalog; DROP TABLE IF EXISTS materials_catalog; DELETE FROM applied_migrations WHERE filename = '061_materials_catalog.sql';
