-- Migration 040: tabla project_notes para anotaciones rápidas del arquitecto
-- Fecha: 2026-04-26
--
-- Damián a veces necesita dejar una nota rápida sobre un proyecto que NO
-- es output de un agente. Ej: "el cliente prefiere reuniones por la tarde",
-- "el portero del edificio tiene la llave maestra", etc. Esta tabla guarda
-- esas anotaciones libres ligadas al proyecto.

CREATE TABLE IF NOT EXISTS project_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  body        text NOT NULL,
  category    text DEFAULT 'general' CHECK (category IN ('general','client_pref','site_access','contract','warning','idea')),
  pinned      boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  text DEFAULT 'damian'
);

CREATE INDEX IF NOT EXISTS idx_project_notes_project ON project_notes (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_notes_pinned ON project_notes (project_id, pinned) WHERE pinned = true;

-- Verificacion (manual):
-- INSERT INTO project_notes (project_id, body, category) VALUES ((SELECT id FROM projects LIMIT 1), 'test note', 'general') RETURNING id;
