-- ============================================================
-- Migración 030: Registro y Trazabilidad de Mensajes WhatsApp Cloud API
-- Proyecto: ClubLab v2026
-- Propósito: Trazabilidad end-to-end (wamid, estados y eventos de error)
-- ============================================================

CREATE TABLE IF NOT EXISTS whatsapp_message_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wamid TEXT UNIQUE NOT NULL,
    waba_id TEXT,
    phone_number_id TEXT,
    recipient_phone TEXT NOT NULL,
    template_name TEXT,
    language TEXT,
    initial_status TEXT NOT NULL DEFAULT 'accepted',
    current_status TEXT NOT NULL DEFAULT 'accepted',
    
    -- Error details (si status === 'failed')
    error_code INTEGER,
    error_title TEXT,
    error_message TEXT,
    error_details TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    
    -- Payload de respuesta inicial y metadata
    raw_initial_response JSONB,
    raw_last_webhook_event JSONB
);

-- Índices de alto rendimiento
CREATE INDEX IF NOT EXISTS idx_wa_logs_wamid ON whatsapp_message_logs(wamid);
CREATE INDEX IF NOT EXISTS idx_wa_logs_recipient ON whatsapp_message_logs(recipient_phone);
CREATE INDEX IF NOT EXISTS idx_wa_logs_status ON whatsapp_message_logs(current_status);
CREATE INDEX IF NOT EXISTS idx_wa_logs_created_at ON whatsapp_message_logs(created_at DESC);
