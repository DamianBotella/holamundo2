-- Migration 037: tabla agent_prompts_history para auditoria de cambios de prompts
-- Fecha: 2026-04-26
--
-- agent_prompts ya soporta versionado (campo version + is_active +
-- unique index). Lo que falta es un audit trail: cuando se cambia un
-- prompt (UPDATE) o se borra (DELETE) queremos preservar la version
-- antigua para diagnostico ('por que el agente_briefing empezo a
-- alucinar el 12 de marzo?' -> ver el prompt en vigor en esa fecha).

CREATE TABLE IF NOT EXISTS agent_prompts_history (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id         uuid NOT NULL,
  agent_name        text NOT NULL,
  prompt_type       text NOT NULL,
  version           integer NOT NULL,
  is_active         boolean NOT NULL,
  content           text NOT NULL,
  model_recommended text,
  temperature       numeric(3,2),
  notes             text,
  operation         text NOT NULL CHECK (operation IN ('UPDATE','DELETE')),
  changed_at        timestamptz NOT NULL DEFAULT now(),
  changed_by        text DEFAULT current_user
);

CREATE INDEX IF NOT EXISTS idx_prompts_history_agent ON agent_prompts_history (agent_name, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_prompts_history_prompt ON agent_prompts_history (prompt_id, changed_at DESC);

-- Trigger: copia OLD al historial antes de UPDATE/DELETE
CREATE OR REPLACE FUNCTION snapshot_agent_prompt()
RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN
  INSERT INTO agent_prompts_history (
    prompt_id, agent_name, prompt_type, version, is_active, content,
    model_recommended, temperature, notes, operation
  ) VALUES (
    OLD.id, OLD.agent_name, OLD.prompt_type, OLD.version, OLD.is_active, OLD.content,
    OLD.model_recommended, OLD.temperature, OLD.notes, TG_OP
  );
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$body$;

DROP TRIGGER IF EXISTS agent_prompts_audit ON agent_prompts;
CREATE TRIGGER agent_prompts_audit
  BEFORE UPDATE OR DELETE ON agent_prompts
  FOR EACH ROW EXECUTE FUNCTION snapshot_agent_prompt();

-- Vista helper: prompts mas modificados ultimo mes
CREATE OR REPLACE VIEW agent_prompts_churn AS
SELECT agent_name,
       prompt_type,
       count(*) AS changes_30d,
       max(changed_at) AS last_change_at,
       array_agg(DISTINCT operation) AS ops
  FROM agent_prompts_history
 WHERE changed_at > now() - INTERVAL '30 days'
 GROUP BY agent_name, prompt_type
 ORDER BY changes_30d DESC;

-- Verificacion (manual):
-- UPDATE agent_prompts SET notes = 'test' || coalesce(notes, '') WHERE agent_name='agent_briefing' RETURNING id;
-- SELECT * FROM agent_prompts_history WHERE agent_name='agent_briefing' ORDER BY changed_at DESC LIMIT 1;
