-- ============================================================================
-- SMTP por empresa — cada emisor puede configurar su propio buzón para
-- enviar sus facturas sin saturar el buzón central de la plataforma.
--
-- Fallback: si la empresa no tiene mail_host, el mailer.service usa el
-- MAIL_HOST/USER/PASS del .env como antes.
-- La password se guarda cifrada con la misma ENCRYPTION_KEY que usa CSD.
-- ============================================================================
ALTER TABLE companies ADD COLUMN IF NOT EXISTS mail_host        VARCHAR(120);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS mail_port        INTEGER;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS mail_secure      BOOLEAN DEFAULT FALSE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS mail_user        VARCHAR(160);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS mail_pass_enc    TEXT;   -- ciphertext base64
ALTER TABLE companies ADD COLUMN IF NOT EXISTS mail_from        VARCHAR(200);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS mail_updated_at  TIMESTAMPTZ;
