-- Migration 006: pgvector + embeddings sobre memory_cases
-- Soporte para búsqueda semántica de casos similares (memory_v2)
-- Usado por: util_generate_embedding, util_search_similar_cases,
-- agent_memory (genera embedding al guardar case),
-- agent_briefing (busca casos similares al iniciar proyecto).
-- Fecha: 2026-04-25

-- 1) Habilitar la extensión pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2) Añadir columnas de embedding a memory_cases
ALTER TABLE memory_cases
  ADD COLUMN IF NOT EXISTS embedding      vector(1536),  -- text-embedding-3-small
  ADD COLUMN IF NOT EXISTS embedding_text text;          -- texto original con el que se generó

-- 3) Índice IVFFLAT para búsqueda por similitud coseno
--    (lists = 50 es razonable hasta ~10k cases. Subir si crece.)
CREATE INDEX IF NOT EXISTS idx_memory_cases_embedding
  ON memory_cases
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 50);

-- ============================================================
-- Verificación post-migración
-- ============================================================
-- SELECT extname FROM pg_extension WHERE extname = 'vector';
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'memory_cases' AND column_name IN ('embedding','embedding_text');
-- SELECT indexname FROM pg_indexes WHERE tablename = 'memory_cases';

-- Ejemplo de búsqueda por similitud coseno (top 5 casos más parecidos):
-- SELECT id, summary, 1 - (embedding <=> $1::vector) AS similarity
-- FROM memory_cases
-- WHERE embedding IS NOT NULL
-- ORDER BY embedding <=> $1::vector
-- LIMIT 5;
