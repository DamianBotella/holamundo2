-- Migration 033: IP blocklist (auto-ban temporal de scanners)
-- Fecha: 2026-04-26
--
-- Tras la integracion del honeypot_trap, queremos que tras 3+ hits de la
-- misma IP en una ventana de 10 min se la auto-bloquee 24 horas. Eso
-- corta el escaneo en frio sin intervencion manual.

CREATE TABLE IF NOT EXISTS ip_blocklist (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_ip          text NOT NULL UNIQUE,
  blocked_until      timestamptz NOT NULL,
  reason             text NOT NULL,
  evidence_event_ids uuid[],
  hit_count          integer DEFAULT 1,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Index sin WHERE filter porque now() no es IMMUTABLE en index predicate.
-- La query is_ip_blocked() compara contra now() en runtime.
CREATE INDEX IF NOT EXISTS idx_ip_blocklist_active
  ON ip_blocklist (source_ip, blocked_until);

-- Helper: TRUE si la IP esta bloqueada actualmente.
CREATE OR REPLACE FUNCTION is_ip_blocked(p_source_ip text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $body$
  SELECT EXISTS(
    SELECT 1 FROM ip_blocklist
     WHERE source_ip = p_source_ip
       AND blocked_until > now()
  );
$body$;

-- Helper: bloquea una IP. Si ya existe, extiende blocked_until si la nueva
-- duracion es mayor, y appendea el evento como evidencia. Devuelve el id del
-- registro de blocklist.
CREATE OR REPLACE FUNCTION ban_ip(
  p_source_ip text,
  p_duration interval,
  p_reason text,
  p_evidence_event_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
AS $body$
DECLARE
  v_id uuid;
  v_until timestamptz;
BEGIN
  v_until := now() + p_duration;

  INSERT INTO ip_blocklist (source_ip, blocked_until, reason, evidence_event_ids, hit_count)
  VALUES (
    p_source_ip,
    v_until,
    p_reason,
    CASE WHEN p_evidence_event_id IS NOT NULL THEN ARRAY[p_evidence_event_id] ELSE ARRAY[]::uuid[] END,
    1
  )
  ON CONFLICT (source_ip) DO UPDATE
     SET blocked_until      = GREATEST(ip_blocklist.blocked_until, EXCLUDED.blocked_until),
         reason             = EXCLUDED.reason,
         evidence_event_ids = ip_blocklist.evidence_event_ids
                              || COALESCE(EXCLUDED.evidence_event_ids, ARRAY[]::uuid[]),
         hit_count          = ip_blocklist.hit_count + 1,
         updated_at         = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$body$;

-- Verificacion (manual):
-- SELECT ban_ip('1.2.3.4', INTERVAL '24 hours', 'test', NULL);
-- SELECT is_ip_blocked('1.2.3.4');                      -- true
-- SELECT * FROM ip_blocklist WHERE source_ip='1.2.3.4';
-- DELETE FROM ip_blocklist WHERE source_ip='1.2.3.4';
