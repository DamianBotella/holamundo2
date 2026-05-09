-- 063: grants_active (Fase A.2 plan Opus, original 022)
-- Catalogo PUBLICO de subvenciones activas. Compartido entre tenants (sin RLS).

BEGIN;

CREATE TABLE IF NOT EXISTS grants_active (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre                  text NOT NULL,
  organismo               text NOT NULL,
  ambito                  text CHECK (ambito IN ('estatal','autonomico','local','europeo')),
  comunidad_autonoma      text,
  tipo                    text CHECK (tipo IN (
    'rehabilitacion','eficiencia_energetica','accesibilidad',
    'obra_nueva','digitalizacion','agricultura','otros'
  )),
  importe_maximo          numeric(12,2),
  porcentaje_maximo       numeric(5,2),
  fecha_apertura          date,
  fecha_cierre            date,
  url_convocatoria        text,
  requisitos              text,
  documentacion_requerida jsonb,
  compatible_con_otras    boolean DEFAULT true,
  normativa_confidence    numeric(3,2) CHECK (normativa_confidence BETWEEN 0 AND 1),
  citation_source         text,
  fetched_at              timestamptz DEFAULT now(),
  active                  boolean DEFAULT true,
  UNIQUE (nombre, organismo)
);

CREATE INDEX IF NOT EXISTS idx_grants_tipo
  ON grants_active(tipo) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_grants_cierre
  ON grants_active(fecha_cierre) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_grants_ambito
  ON grants_active(ambito, comunidad_autonoma) WHERE active = true;

INSERT INTO applied_migrations (filename, notes) VALUES
  ('063_grants_active.sql', 'A.2 plan Opus (originalmente 022): subvenciones publicas compartidas, sin RLS')
ON CONFLICT (filename) DO NOTHING;

COMMIT;

-- rollback: DROP TABLE IF EXISTS grants_active; DELETE FROM applied_migrations WHERE filename = '063_grants_active.sql';
