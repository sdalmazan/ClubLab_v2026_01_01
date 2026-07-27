-- ============================================================
-- Migración 031: Rediseño Onboarding OTP y Canal Único de Notificaciones
-- Proyecto: ClubLab v2026
-- ============================================================

-- 1. Añadir columnas de verificación y canal único en players
ALTER TABLE players ADD COLUMN IF NOT EXISTS notification_channel TEXT DEFAULT 'email';
ALTER TABLE players ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE players ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
ALTER TABLE players ADD COLUMN IF NOT EXISTS whatsapp_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE players ADD COLUMN IF NOT EXISTS whatsapp_verified_at TIMESTAMPTZ;
ALTER TABLE players ADD COLUMN IF NOT EXISTS channel_last_changed_at TIMESTAMPTZ;

-- 2. Crear tabla auth_otp_codes para códigos OTP seguros
CREATE TABLE IF NOT EXISTS auth_otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  channel TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'onboarding',
  expires_at TIMESTAMPTZ NOT NULL,
  attempts_count INT DEFAULT 0,
  verified_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_otp_codes_lookup ON auth_otp_codes(identifier, channel, purpose);

-- 3. RLS para auth_otp_codes
ALTER TABLE auth_otp_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow admin full access to auth_otp_codes" ON auth_otp_codes;
CREATE POLICY "Allow admin full access to auth_otp_codes" ON auth_otp_codes FOR ALL USING (true);

-- 4. Migración de preferencias heredadas de notificación para usuarios existentes:
-- Regla de migración respetando la falta de evidencia de verificación previa:
-- whatsapp = true + email = false -> notification_channel = 'whatsapp', whatsapp_verified = false
-- whatsapp = false + email = true -> notification_channel = 'email', email_verified = false
-- whatsapp = true + email = true -> notification_channel = 'email', email_verified = false, whatsapp_verified = false
-- whatsapp = false + email = false -> notification_channel = 'email', email_verified = false
UPDATE players
SET 
  notification_channel = CASE 
    WHEN notification_pref_whatsapp = TRUE AND notification_pref_email = FALSE THEN 'whatsapp'
    ELSE 'email'
  END,
  email_verified = COALESCE(email_verified, FALSE),
  whatsapp_verified = COALESCE(whatsapp_verified, FALSE)
WHERE notification_channel IS NULL OR notification_channel = '';
