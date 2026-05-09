-- 065: municipal_templates (Fase A.2 plan Opus, original 024)
-- Plantillas tramite por ayuntamiento. PUBLICA (compartida entre tenants).

BEGIN;

CREATE TABLE IF NOT EXISTS municipal_templates (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipio                text NOT NULL,
  provincia                text NOT NULL,
  tipo_tramite             text NOT NULL CHECK (tipo_tramite IN (
    'licencia_obra_menor','licencia_obra_mayor','comunicacion_previa',
    'declaracion_responsable','iee','cambio_uso','primera_ocupacion'
  )),
  documentos_requeridos    jsonb NOT NULL,
  formato_expediente       text CHECK (formato_expediente IN ('PDF','XML','ZIP','XBRL')),
  sede_electronica_url     text,
  tamano_maximo_mb         integer DEFAULT 50,
  formatos_admitidos       jsonb,
  requiere_firma_digital   boolean DEFAULT true,
  notas                    text,
  citation_source          text,
  fetched_at               timestamptz DEFAULT now(),
  updated_at               timestamptz DEFAULT now(),
  UNIQUE (municipio, tipo_tramite)
);

CREATE INDEX IF NOT EXISTS idx_municipal_municipio ON municipal_templates(municipio);
CREATE INDEX IF NOT EXISTS idx_municipal_provincia ON municipal_templates(provincia, municipio);

INSERT INTO applied_migrations (filename, notes) VALUES
  ('065_municipal_templates.sql', 'A.2 plan Opus (originalmente 024): plantillas tramite por municipio, sin RLS')
ON CONFLICT (filename) DO NOTHING;

COMMIT;

-- rollback: DROP TABLE IF EXISTS municipal_templates; DELETE FROM applied_migrations WHERE filename = '065_municipal_templates.sql';
