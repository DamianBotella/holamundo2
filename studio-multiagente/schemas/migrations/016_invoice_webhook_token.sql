-- Migration 016: webhook_token en invoices para aprobacion via email
-- Fecha: 2026-04-25
--
-- Mismo patron que approvals.webhook_token y proposals.webhook_token:
-- token unico por factura, generado automaticamente, usado para validar
-- el clic en los botones aprobar/disputar/rechazar del email.

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS webhook_token text;

-- Backfill: generar token para facturas existentes que no lo tienen
UPDATE invoices SET webhook_token = encode(gen_random_bytes(16), 'hex')
 WHERE webhook_token IS NULL;

-- Default para nuevos INSERT
ALTER TABLE invoices
  ALTER COLUMN webhook_token SET DEFAULT encode(gen_random_bytes(16), 'hex');

CREATE INDEX IF NOT EXISTS idx_invoices_token ON invoices (webhook_token);

-- ============================================================
-- Verificacion
-- ============================================================
-- SELECT count(*) FROM invoices WHERE webhook_token IS NOT NULL; -- = total
-- SELECT column_default FROM information_schema.columns
--   WHERE table_name='invoices' AND column_name='webhook_token';
