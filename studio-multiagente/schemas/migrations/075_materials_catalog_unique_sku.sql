-- ============================================================
-- Migration 075: UNIQUE parcial (tenant_id, sku_fabricante) en materials_catalog
-- Fecha: 2026-05-11
-- Bloque: B72-fase-C agent_catalog_sync
-- ============================================================
--
-- Por que: agent_catalog_sync hace UPSERT con
--   INSERT ... ON CONFLICT (tenant_id, sku_fabricante) WHERE sku_fabricante IS NOT NULL
--   DO UPDATE ...
-- Sin un UNIQUE constraint / unique index sobre esa pareja de columnas, el
-- planner de Postgres rechaza el ON CONFLICT con error "no unique or
-- exclusion constraint matching the ON CONFLICT specification".
--
-- Usamos UNIQUE INDEX PARCIAL en lugar de UNIQUE constraint completo porque:
--   - Hay items legitimos sin SKU (proveedor local, manual, etc.) -> deben
--     poder convivir multiples NULL por tenant.
--   - La unicidad solo aplica cuando sku_fabricante NO es NULL.
--
-- Idempotente: CREATE UNIQUE INDEX IF NOT EXISTS.
-- ============================================================

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS materials_catalog_tenant_sku_partial
  ON materials_catalog (tenant_id, sku_fabricante)
  WHERE sku_fabricante IS NOT NULL;

INSERT INTO applied_migrations (filename, notes) VALUES
  ('075_materials_catalog_unique_sku.sql', 'B72-fase-C: UNIQUE partial (tenant_id, sku_fabricante) para ON CONFLICT de agent_catalog_sync')
ON CONFLICT (filename) DO NOTHING;

COMMIT;

-- ============================================================
-- VERIFICACION
-- Esperado: 1 fila con materials_catalog_tenant_sku_partial
-- ============================================================
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'materials_catalog' AND indexname = 'materials_catalog_tenant_sku_partial';

-- rollback: DROP INDEX IF EXISTS materials_catalog_tenant_sku_partial;
--           DELETE FROM applied_migrations WHERE filename = '075_materials_catalog_unique_sku.sql';
