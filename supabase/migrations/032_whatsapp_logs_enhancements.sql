-- ============================================================
-- Migración 032: Diagnóstico Avanzado y Rastreo de Estados WhatsApp Cloud API
-- Proyecto: ClubLab v2026
-- ============================================================

-- 1. Añadir columna purpose a whatsapp_message_logs
ALTER TABLE whatsapp_message_logs ADD COLUMN IF NOT EXISTS purpose TEXT DEFAULT 'onboarding';

-- 2. Asegurar que initial_status por defecto sea 'dispatch_requested'
ALTER TABLE whatsapp_message_logs ALTER COLUMN initial_status SET DEFAULT 'dispatch_requested';

-- 3. Índices de diagnóstico rápido
CREATE INDEX IF NOT EXISTS idx_wa_logs_purpose ON whatsapp_message_logs(purpose);
CREATE INDEX IF NOT EXISTS idx_wa_logs_recipient_phone ON whatsapp_message_logs(recipient_phone);
CREATE INDEX IF NOT EXISTS idx_wa_logs_status_updated ON whatsapp_message_logs(current_status, updated_at DESC);

-- 4. RLS para whatsapp_message_logs (Acceso exclusivo de administración)
ALTER TABLE whatsapp_message_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow admin full access to whatsapp_message_logs" ON whatsapp_message_logs;
CREATE POLICY "Allow admin full access to whatsapp_message_logs" ON whatsapp_message_logs FOR ALL USING (true);
