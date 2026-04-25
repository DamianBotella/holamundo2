-- Migration 019: centralizar architect_email en system_config
-- Fecha: 2026-04-25
--
-- Antes, el email del arquitecto (botelladesdeel98@gmail.com) estaba hardcodeado
-- en 21 nodos a lo largo de 17 workflows distintos. Cambiar la direccion implicaba
-- editar 17 workflows uno a uno.
--
-- Ahora vive en system_config.architect_email. Cada workflow que lo necesita
-- ejecuta antes de cualquier nodo Gmail un nodo Postgres "Load Architect Email":
--   SELECT value FROM system_config WHERE key = 'architect_email'
-- y referencia el resultado:
--   sendTo: ={{ $('Load Architect Email').first().json.value }}
--
-- Para cambiar la direccion en TODO el sistema:
--   UPDATE system_config SET value='nueva.direccion@x.com' WHERE key='architect_email';
-- Surte efecto inmediato en la siguiente ejecucion de cualquier workflow.
--
-- Verificacion E2E (2026-04-25):
--   - cron_quote_expiry ejecutado antes/despues de UPDATE -> el nodo
--     Load Architect Email recogio el nuevo valor sin redespliegue.

INSERT INTO system_config (key, value, description) VALUES (
  'architect_email',
  'botelladesdeel98@gmail.com',
  'Email del arquitecto principal — destino de notificaciones, alertas y aprobaciones. Se lee al inicio de cada workflow que envia emails (nodo Postgres "Load Architect Email"). Cambiar aqui se propaga a todos los workflows en la siguiente ejecucion.'
) ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- Verificacion
-- ============================================================
-- SELECT key, value FROM system_config WHERE key='architect_email';
--   -> botelladesdeel98@gmail.com

-- Lista de workflows migrados (29 workflows, 21 nodos email reemplazados):
--   error_handler                  qfQWaGSpyjgdeFt5  (2 sendTo)
--   util_notification              ks2CqrtJCxLJTPdV  (jsCode fallback)
--   agent_normativa_refresh        0Cyeaa85uLS7c8EE  (jsCode)
--   cron_permit_review             0LK6VrMq5lHOFJaL  (sendTo)
--   util_architect_presence        1WLpSzgcitGJoaoZ  (sendTo)
--   cron_consultation_batch        4vyizezPgg3kr192  (executeWorkflow recipient)
--   cron_drive_cleanup             6bG0DUrVWo9uBbNz  (sendTo)
--   cron_security_alerts           A0MgvE97s3IRicmt  (sendTo)
--   cron_project_review            AX05W4baMEfJokWN  (sendTo)
--   trade_quote_request            C8LmBilsqMTGNFut  (ccList)
--   agent_site_monitor             DPy3FBugAbWP10BD  (sendTo)
--   aftercare_submit               GkcU8G1y3gFOeZp9  (sendTo)
--   cron_weekly_summary            HFmOG0ouMuG1KCmb  (sendTo)
--   cron_external_backup           Hv8RlkxGhCL6g0FQ  (sendTo)
--   agent_pathology                I34LYGuiWTQ8WJCa  (sendTo)
--   agent_financial_tracker        LEspjLl6VEHPclPG  (sendTo)
--   agent_proposal                 Mqx8S6nR6exbRY86  (sendTo)
--   trade_quote_reply              NmZApRC3Oj7nkRIS  (sendTo)
--   agent_regulatory               QbRMmQs0oyVHplgE  (jsCode)
--   cron_anomaly_detect            RHrP8BowouYVCKjz  (sendTo)
--   util_consultation              bjKNchMYN2wXKO0k  (executeWorkflow recipient)
--   cron_financial_review          eg57HYIXCfcTbj7F  (sendTo)
--   cron_aftercare_review          hcXJyJB8hqevVxW2  (sendTo)
--   cron_quote_expiry              naRs3Zge1i3VFxCS  (sendTo)
--   cron_aftercare_followup        rO1sOgzJ3WYvuLLG  (sendTo)
--   agent_design                   sMGf7e8CSnsBQa1q  (jsCode)
--   agent_briefing                 uq3GQWSdmoIV4ZdR  (jsCode)
--   aftercare_public_submit        x5j2VKbz9tfQyqzl  (sendTo)
--   aftercare_assign_resolve       xdkQuIdOwLZw68sK  (ccList, solo rama assign)
