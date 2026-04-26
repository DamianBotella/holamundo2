-- Migration 023: agent_collab_coordinator
-- Fecha: 2026-04-26
--
-- Dos tablas para coordinar colaboradores externos puntuales (estructuristas,
-- ingenieros instalaciones, paisajistas, etc) en proyectos:
--
--   - collaborators: catalogo de profesionales externos con su especialidad y datos.
--   - collab_assignments: asignaciones de entregables (rol + scope + deliverables +
--     deadline + fee). Status sigue ciclo invited -> accepted -> in_progress ->
--     delivered -> approved -> closed.
--
-- 3 workflows MVP:
--   - collab_register (0FTkQZ7DmwUH7wif): POST /webhook/collab-register
--   - collab_assign   (8BFQs3rWSfWp7nTJ): POST /webhook/collab-assign (envia email
--     al colaborador con CC a Damian)
--   - collab_update_status (1iZQkV6uzkRDqpfF): POST /webhook/collab-update
--     (actualiza status, dispara email a Damian con resumen)

CREATE TABLE IF NOT EXISTS collaborators (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  email           text NOT NULL,
  phone           text,
  specialty       text NOT NULL CHECK (specialty IN (
                    'estructurista','instalaciones','paisajismo','interiorista','arquitecto',
                    'aparejador','ingeniero','topografo','geotecnico','otros')),
  company         text,
  collegiate_no   text,
  hourly_rate_eur numeric(10,2),
  notes           text,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_collaborators_specialty ON collaborators (specialty) WHERE active = true;

CREATE TABLE IF NOT EXISTS collab_assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  collaborator_id uuid NOT NULL REFERENCES collaborators(id) ON DELETE RESTRICT,
  role            text NOT NULL,
  scope           text NOT NULL,
  deliverables    jsonb NOT NULL DEFAULT '[]'::jsonb,
  fee_eur         numeric(10,2),
  deadline        date,
  status          text NOT NULL DEFAULT 'invited' CHECK (status IN (
                    'invited','accepted','rejected','in_progress','delivered','approved','rejected_delivery','closed','cancelled')),
  invited_at      timestamptz NOT NULL DEFAULT now(),
  accepted_at     timestamptz,
  delivered_at    timestamptz,
  approved_at     timestamptz,
  closed_at       timestamptz,
  delivery_files  jsonb DEFAULT '[]'::jsonb,
  decision_notes  text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_collab_assignments_project ON collab_assignments (project_id, status);
CREATE INDEX IF NOT EXISTS idx_collab_assignments_active  ON collab_assignments (status) WHERE status NOT IN ('closed','cancelled','rejected');

CREATE OR REPLACE FUNCTION touch_collaborators()
RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$body$;

DROP TRIGGER IF EXISTS collaborators_touch ON collaborators;
CREATE TRIGGER collaborators_touch BEFORE UPDATE ON collaborators
  FOR EACH ROW EXECUTE FUNCTION touch_collaborators();

CREATE OR REPLACE FUNCTION touch_collab_assignments()
RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN
  NEW.updated_at := now();
  IF NEW.status = 'accepted'  AND OLD.status IS DISTINCT FROM 'accepted'  AND NEW.accepted_at  IS NULL THEN NEW.accepted_at  := now(); END IF;
  IF NEW.status = 'delivered' AND OLD.status IS DISTINCT FROM 'delivered' AND NEW.delivered_at IS NULL THEN NEW.delivered_at := now(); END IF;
  IF NEW.status = 'approved'  AND OLD.status IS DISTINCT FROM 'approved'  AND NEW.approved_at  IS NULL THEN NEW.approved_at  := now(); END IF;
  IF NEW.status = 'closed'    AND OLD.status IS DISTINCT FROM 'closed'    AND NEW.closed_at    IS NULL THEN NEW.closed_at    := now(); END IF;
  RETURN NEW;
END;
$body$;

DROP TRIGGER IF EXISTS collab_assignments_touch ON collab_assignments;
CREATE TRIGGER collab_assignments_touch BEFORE UPDATE ON collab_assignments
  FOR EACH ROW EXECUTE FUNCTION touch_collab_assignments();

-- ============================================================
-- Verificacion E2E (2026-04-25/26)
-- ============================================================
-- 1. POST /webhook/collab-register {name, email, specialty, collegiate_no, hourly_rate_eur}
--    -> 201 con collaborator_id
-- 2. POST /webhook/collab-assign {project_id, collaborator_id, role, scope,
--    deliverables, fee_eur, deadline} -> 201 con assignment_id, email enviado al
--    colaborador con CC a Damian
-- 3. POST /webhook/collab-update {assignment_id, new_status='accepted', decision_notes}
--    -> 200, accepted_at poblado por trigger, email resumen a Damian
