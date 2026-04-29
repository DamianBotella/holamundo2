-- ============================================================
-- Migration 048: ampliar CHECK constraint regulatory_tasks.task_type
-- Fecha: 2026-04-29 (B32 / X1v4)
-- ============================================================
-- Por que: en B26 (migration 044) ampliamos los task_types validos en el
-- PROMPT de agent_regulatory para incluir el marco tecnico espanol
-- (proyecto_tecnico, estudio_seguridad_salud, estudio_basico_ss,
-- certificado_eficiencia_energetica, gestion_rcd, boletines_instalaciones,
-- cumplimiento_db_sua_accesibilidad, cedula_compatibilidad_urbanistica).
--
-- Pero NO actualizamos el CHECK constraint de la tabla regulatory_tasks.
-- Resultado: el LLM produce output correcto pero el INSERT falla con
-- "violates check constraint regulatory_tasks_task_type_check".
--
-- Descubierto al certificar X1v4 — el agent corre, parsea, pero falla al
-- guardar. Bug 5 de la sesion. Patron: cambiar prompt sin cambiar schema.
--
-- Esta migration:
-- 1. DROP el constraint viejo.
-- 2. CREATE el nuevo con los 14 task_types.
-- ============================================================

-- 1. Drop constraint viejo
ALTER TABLE regulatory_tasks
  DROP CONSTRAINT IF EXISTS regulatory_tasks_task_type_check;

-- 2. Create nuevo con 14 valores (los del prompt v2)
ALTER TABLE regulatory_tasks
  ADD CONSTRAINT regulatory_tasks_task_type_check
  CHECK (task_type IN (
    'licencia_obra',
    'comunicacion_previa',
    'permiso_comunidad',
    'certificado_habitabilidad',
    'cedula_urbanistica',
    'cedula_compatibilidad_urbanistica',
    'informe_tecnico',
    'proyecto_tecnico',
    'estudio_seguridad_salud',
    'estudio_basico_ss',
    'certificado_eficiencia_energetica',
    'gestion_rcd',
    'boletines_instalaciones',
    'cumplimiento_db_sua_accesibilidad',
    'otro'
  ));

INSERT INTO applied_migrations (filename, applied_at, applied_by, notes)
VALUES ('048_regulatory_tasks_task_type_constraint_v2.sql', NOW(), 'B32 X1v4', 'Sync constraint con prompt v2 de B26. Bug 5.')
ON CONFLICT (filename) DO NOTHING;
