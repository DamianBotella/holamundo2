-- 086: ADDENDUM 2 Bloque 6: RAG semantico sobre municipal_pgou_rules.
--
-- Premisa esquema real (mig 077):
--   municipal_pgou_rules ya existe con columnas:
--   id, municipio_slug, municipio_nombre, provincia, ccaa, rule_key,
--   rule_category, rule_title, rule_description, normative_reference,
--   normative_url, applies_to (jsonb), triggers (jsonb), license_implication,
--   pitfalls (jsonb), severity, version_rule, last_verified_at, source_doc,
--   created_at, updated_at.
--
--   El ADDENDUM 2 documentaba un esquema simplificado (municipio/categoria/
--   parametro/valor/unidad/descripcion/fuente_url). Lo mapeamos a las
--   columnas reales en searchable_text y en search_pgou_rules().

BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- 1. Columnas nuevas para RAG
-- ============================================================
ALTER TABLE municipal_pgou_rules
  ADD COLUMN IF NOT EXISTS embedding          vector(1536),
  ADD COLUMN IF NOT EXISTS searchable_text    text,
  ADD COLUMN IF NOT EXISTS pregunta_frecuente text,
  ADD COLUMN IF NOT EXISTS respuesta_natural  text;

-- ============================================================
-- 2. Backfill searchable_text concatenando lo que mas firma
--    semanticamente para un arquitecto consultando normativa
-- ============================================================
UPDATE municipal_pgou_rules
   SET searchable_text =
     COALESCE(municipio_nombre,'') || ' | ' ||
     COALESCE(rule_category,'')    || ' | ' ||
     COALESCE(rule_title,'')       || ' | ' ||
     COALESCE(rule_description,'') || ' | ' ||
     COALESCE(normative_reference,'') || ' | ' ||
     COALESCE(severity,'')
 WHERE searchable_text IS NULL;

-- ============================================================
-- 3. Indice ivfflat para busqueda semantica
--    (lists=50 es razonable para ~100-500 reglas; subir cuando
--    crezca el corpus)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_pgou_rules_embedding
  ON municipal_pgou_rules
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 50);

-- ============================================================
-- 4. Funcion search_pgou_rules
--    Filtro por municipio (slug o nombre), retorna las top_k
--    reglas mas cercanas semanticamente con sus campos REALES.
--    El endpoint /api/v1/regulatory/ask la consume.
-- ============================================================
CREATE OR REPLACE FUNCTION search_pgou_rules(
  p_municipio       text,
  p_query_embedding vector(1536),
  p_top_k           int DEFAULT 5
) RETURNS TABLE (
  id                  uuid,
  municipio_slug      text,
  municipio_nombre    text,
  rule_category       text,
  rule_title          text,
  rule_description    text,
  normative_reference text,
  normative_url       text,
  severity            text,
  pitfalls            jsonb,
  similarity          float
) LANGUAGE sql STABLE AS $$
  SELECT
    r.id,
    r.municipio_slug,
    r.municipio_nombre,
    r.rule_category,
    r.rule_title,
    r.rule_description,
    r.normative_reference,
    r.normative_url,
    r.severity,
    r.pitfalls,
    1 - (r.embedding <=> p_query_embedding) AS similarity
  FROM municipal_pgou_rules r
  WHERE (r.municipio_slug   ILIKE p_municipio
      OR r.municipio_nombre ILIKE p_municipio)
    AND r.embedding IS NOT NULL
  ORDER BY r.embedding <=> p_query_embedding
  LIMIT p_top_k;
$$;

GRANT EXECUTE ON FUNCTION search_pgou_rules(text, vector, int) TO authenticated;

-- ============================================================
-- 5. Registro de migracion
-- ============================================================
INSERT INTO applied_migrations (filename, notes) VALUES (
  '086_municipal_pgou_embeddings.sql',
  'ADDENDUM 2 Bloque 6: embedding+searchable_text+pregunta_frecuente+respuesta_natural en municipal_pgou_rules; funcion search_pgou_rules() para RAG semantico'
) ON CONFLICT (filename) DO NOTHING;

COMMIT;

-- ============================================================
-- Verificacion
-- ============================================================
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name='municipal_pgou_rules'
--    AND column_name IN ('embedding','searchable_text','pregunta_frecuente','respuesta_natural');
-- expected: 4
--
-- SELECT COUNT(*) FROM municipal_pgou_rules WHERE searchable_text IS NOT NULL;
-- expected: 94 (las 94 reglas seed de las 5 ciudades top)
--
-- Tras backfill_pgou_embeddings.mjs (Bloque 6 script offline) probar:
-- SELECT * FROM search_pgou_rules('madrid', '<vector 1536>', 5);

-- ============================================================
-- Rollback
-- ============================================================
-- BEGIN;
-- DROP FUNCTION IF EXISTS search_pgou_rules(text, vector, int);
-- DROP INDEX IF EXISTS idx_pgou_rules_embedding;
-- ALTER TABLE municipal_pgou_rules DROP COLUMN IF EXISTS respuesta_natural;
-- ALTER TABLE municipal_pgou_rules DROP COLUMN IF EXISTS pregunta_frecuente;
-- ALTER TABLE municipal_pgou_rules DROP COLUMN IF EXISTS searchable_text;
-- ALTER TABLE municipal_pgou_rules DROP COLUMN IF EXISTS embedding;
-- DELETE FROM applied_migrations WHERE filename='086_municipal_pgou_embeddings.sql';
-- COMMIT;
