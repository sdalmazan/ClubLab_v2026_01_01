-- ============================================================
-- Migración 029: Verificación de WhatsApp y Preferencias de Notificación
-- Proyecto: ClubLab v2026
-- Propósito: Verificación por código OTP de teléfono y canales de aviso
-- ============================================================

-- 1. Añadir campos a la tabla players
ALTER TABLE players ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE players ADD COLUMN IF NOT EXISTS phone_verification_code TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS phone_verification_expires_at TIMESTAMPTZ;

ALTER TABLE players ADD COLUMN IF NOT EXISTS notification_pref_email BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE players ADD COLUMN IF NOT EXISTS notification_pref_whatsapp BOOLEAN NOT NULL DEFAULT FALSE;

-- Índices para búsqueda por teléfono
CREATE INDEX IF NOT EXISTS idx_players_phone_number ON players(phone_number);

-- 2. Añadir campos a la tabla user_organization_roles si aplica a staff
ALTER TABLE user_organization_roles ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE user_organization_roles ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE user_organization_roles ADD COLUMN IF NOT EXISTS notification_pref_email BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE user_organization_roles ADD COLUMN IF NOT EXISTS notification_pref_whatsapp BOOLEAN NOT NULL DEFAULT FALSE;
