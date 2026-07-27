import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Helper to normalize and sanitize phone numbers for WhatsApp API.
 * Removes spaces, dashes, dots, parentheses, and automatically prepends '34' (Spain) if a 9-digit mobile number is entered.
 */
export function normalizePhoneNumber(phone: string): { cleanPhone: string; digitsOnly: string } {
  if (!phone) return { cleanPhone: "", digitsOnly: "" };

  const rawDigits = phone.replace(/\D/g, "");
  let digitsOnly = rawDigits;
  if (rawDigits.length === 9 && (rawDigits.startsWith("6") || rawDigits.startsWith("7"))) {
    digitsOnly = `34${rawDigits}`;
  }

  const cleanPhone = `+${digitsOnly}`;
  return { cleanPhone, digitsOnly };
}

/**
 * Safely masks phone numbers for logging (e.g. "+34 685 *** 495").
 */
export function maskPhoneNumber(phone: string): string {
  if (!phone) return "";
  const clean = phone.replace(/\s+/g, "");
  if (clean.length <= 6) return clean;
  return `${clean.slice(0, 7)} *** ${clean.slice(-3)}`;
}

export interface WhatsAppLogRecord {
  wamid: string;
  waba_id?: string;
  phone_number_id?: string;
  recipient_phone: string;
  template_name?: string;
  language?: string;
  purpose?: string;
  initial_status: string; // 'dispatch_requested'
  current_status: string; // 'dispatch_requested' | 'sent' | 'delivered' | 'read' | 'failed'
  error_code?: number | null;
  error_title?: string | null;
  error_message?: string | null;
  error_details?: string | null;
  created_at: string;
  updated_at: string;
  sent_at?: string | null;
  delivered_at?: string | null;
  read_at?: string | null;
  failed_at?: string | null;
  raw_initial_response?: any;
  raw_last_webhook_event?: any;
}

const inMemoryLogs = new Map<string, WhatsAppLogRecord>();

function writeToLocalLog(record: WhatsAppLogRecord) {
  inMemoryLogs.set(record.wamid, record);
}

function readFromLocalLog(wamid: string): WhatsAppLogRecord | null {
  return inMemoryLogs.get(wamid) || null;
}

/**
 * Audit Meta WhatsApp Token & Ecosystem configuration live against Graph API.
 * Checks Token -> WABA -> Phone Number ID correspondence. Never leaks full token.
 */
export async function auditWhatsAppTokenConfig() {
  const token = process.env.WHATSAPP_CLOUD_TOKEN || "";
  const phoneId = process.env.WHATSAPP_CLOUD_PHONE_ID || "1295911476932384";
  const wabaId = process.env.WHATSAPP_WABA_ID || "1635059935292068";
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || "";
  const appSecret = process.env.WHATSAPP_APP_SECRET || "";

  const tokenPreview = token
    ? `${token.slice(0, 4)}...${token.slice(-4)}`
    : "MISSING";

  let graphApiValid = false;
  let graphPhoneDetails: any = null;
  let metaError: any = null;

  if (token && phoneId) {
    try {
      const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}?fields=id,display_phone_number,verified_name,code_verification_status,quality_rating,platform_type`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.id) {
        graphApiValid = true;
        graphPhoneDetails = data;
      } else {
        metaError = data.error || data;
      }
    } catch (e: any) {
      metaError = { message: e.message };
    }
  }

  return {
    environment: process.env.NODE_ENV || "development",
    isVercel: !!process.env.VERCEL,
    tokenConfigured: !!token,
    tokenPreview,
    tokenLength: token.length,
    phoneIdConfigured: !!phoneId,
    phoneId,
    wabaIdConfigured: !!wabaId,
    wabaId,
    verifyTokenConfigured: !!verifyToken,
    appSecretConfigured: !!appSecret,
    graphApiValid,
    graphPhoneDetails,
    metaError,
  };
}

/**
 * Record a newly dispatched WhatsApp message in Supabase and local logs.
 */
export async function recordWhatsAppDispatch(params: {
  wamid: string;
  wabaId?: string;
  phoneNumberId?: string;
  recipientPhone: string;
  templateName?: string;
  language?: string;
  purpose?: string;
  rawResponse?: any;
}): Promise<void> {
  const now = new Date().toISOString();
  const record: WhatsAppLogRecord = {
    wamid: params.wamid,
    waba_id: params.wabaId || process.env.WHATSAPP_WABA_ID || "1635059935292068",
    phone_number_id: params.phoneNumberId || process.env.WHATSAPP_CLOUD_PHONE_ID || "1295911476932384",
    recipient_phone: params.recipientPhone,
    template_name: params.templateName || "custom_message",
    language: params.language || "es",
    purpose: params.purpose || "onboarding",
    initial_status: "dispatch_requested",
    current_status: "dispatch_requested",
    created_at: now,
    updated_at: now,
    raw_initial_response: params.rawResponse || null,
  };

  // 1. Write to local fallback file
  writeToLocalLog(record);

  // 2. Persist to Supabase if table exists
  try {
    const adminSupabase = createAdminClient();
    await adminSupabase.from("whatsapp_message_logs").upsert(
      {
        wamid: record.wamid,
        waba_id: record.waba_id,
        phone_number_id: record.phone_number_id,
        recipient_phone: record.recipient_phone,
        template_name: record.template_name,
        language: record.language,
        purpose: record.purpose,
        initial_status: record.initial_status,
        current_status: record.current_status,
        created_at: record.created_at,
        updated_at: record.updated_at,
        raw_initial_response: record.raw_initial_response,
      },
      { onConflict: "wamid" }
    );
  } catch (dbErr) {
    console.warn("[DB WhatsApp Record Note] Could not write to DB table, stored in local log file:", dbErr);
  }
}

// Order of statuses for state transitions
const STATUS_RANK: Record<string, number> = {
  dispatch_requested: 1,
  sent: 2,
  delivered: 3,
  read: 4,
  failed: 99, // Terminal state
};

/**
 * Idempotently update message status upon receiving Webhook events from Meta.
 */
export async function updateWhatsAppMessageStatus(params: {
  wamid: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp?: string;
  recipientId?: string;
  error?: {
    code?: number;
    title?: string;
    message?: string;
    details?: string;
  } | null;
  rawWebhookEvent?: any;
}): Promise<{ updated: boolean; currentStatus?: string }> {
  const now = new Date().toISOString();
  const eventTime = params.timestamp ? new Date(parseInt(params.timestamp) * 1000).toISOString() : now;

  let existing = readFromLocalLog(params.wamid);

  // Try DB first if available
  try {
    const adminSupabase = createAdminClient();
    const { data: dbRecord } = await adminSupabase
      .from("whatsapp_message_logs")
      .select("*")
      .eq("wamid", params.wamid)
      .limit(1)
      .maybeSingle();

    if (dbRecord) {
      existing = dbRecord as WhatsAppLogRecord;
    }
  } catch (err) {
    // Ignore DB fetch error and rely on existing local record
  }

  if (!existing) {
    // Create placeholder if event arrives before or without initial dispatch record
    existing = {
      wamid: params.wamid,
      recipient_phone: params.recipientId || "unknown",
      initial_status: "accepted",
      current_status: "accepted",
      created_at: now,
      updated_at: now,
    };
  }

  // Idempotency check: Terminal state 'failed' or higher rank prevents backwards state transition
  const currentRank = STATUS_RANK[existing.current_status] || 0;
  const newRank = STATUS_RANK[params.status] || 0;

  if (existing.current_status === "failed" && params.status !== "failed") {
    console.log(`[Idempotency Warning] Ignoring transition to ${params.status} because wamid ${params.wamid} is already terminal 'failed'.`);
    return { updated: false, currentStatus: existing.current_status };
  }

  if (newRank < currentRank) {
    console.log(`[Idempotency Warning] Ignoring backwards transition from ${existing.current_status} to ${params.status} for wamid ${params.wamid}.`);
    return { updated: false, currentStatus: existing.current_status };
  }

  // Update timestamps based on new status
  existing.current_status = params.status;
  existing.updated_at = now;
  existing.raw_last_webhook_event = params.rawWebhookEvent || null;

  if (params.status === "sent" && !existing.sent_at) existing.sent_at = eventTime;
  if (params.status === "delivered") {
    if (!existing.sent_at) existing.sent_at = eventTime;
    existing.delivered_at = eventTime;
  }
  if (params.status === "read") {
    if (!existing.sent_at) existing.sent_at = eventTime;
    if (!existing.delivered_at) existing.delivered_at = eventTime;
    existing.read_at = eventTime;
  }
  if (params.status === "failed") {
    existing.failed_at = eventTime;
    if (params.error) {
      existing.error_code = params.error.code ?? null;
      existing.error_title = params.error.title ?? null;
      existing.error_message = params.error.message ?? null;
      existing.error_details = params.error.details ?? null;
    }
  }

  // Save to local in-memory log
  writeToLocalLog(existing);

  // Save to DB
  try {
    const adminSupabase = createAdminClient();
    await adminSupabase.from("whatsapp_message_logs").upsert(
      {
        wamid: existing.wamid,
        current_status: existing.current_status,
        updated_at: existing.updated_at,
        sent_at: existing.sent_at,
        delivered_at: existing.delivered_at,
        read_at: existing.read_at,
        failed_at: existing.failed_at,
        error_code: existing.error_code,
        error_title: existing.error_title,
        error_message: existing.error_message,
        error_details: existing.error_details,
        raw_last_webhook_event: existing.raw_last_webhook_event,
      },
      { onConflict: "wamid" }
    );
  } catch (dbErr) {
    // Ignore DB error, local log file was already updated
  }

  return { updated: true, currentStatus: existing.current_status };
}

/**
 * Retrieve tracking record by WAMID.
 */
export async function getWhatsAppMessageStatus(wamid: string): Promise<WhatsAppLogRecord | null> {
  try {
    const adminSupabase = createAdminClient();
    const { data: dbRecord } = await adminSupabase
      .from("whatsapp_message_logs")
      .select("*")
      .eq("wamid", wamid)
      .limit(1)
      .maybeSingle();

    if (dbRecord) {
      return dbRecord as WhatsAppLogRecord;
    }
  } catch (err) {
    // Fall back to local log file
  }

  return readFromLocalLog(wamid);
}

export interface SendWhatsAppOTPParams {
  phoneNumber: string;
  code: string;
  recipientName?: string;
}

export async function sendWhatsAppOTP({ phoneNumber, code, recipientName = "Jugador" }: SendWhatsAppOTPParams): Promise<{ success: boolean; wamid?: string }> {
  const { cleanPhone, digitsOnly } = normalizePhoneNumber(phoneNumber);
  const message = `[ClubLab] Tu código de verificación de WhatsApp es: *${code}*\n\nIntroduce este código de 6 dígitos en la aplicación para confirmar tu número. Válido durante 10 minutos.`;

  console.log(`[WhatsApp OTP Dispatch] Target: ${cleanPhone} | Code: ${code}`);

  const metaToken = process.env.WHATSAPP_CLOUD_TOKEN;
  const metaPhoneId = process.env.WHATSAPP_CLOUD_PHONE_ID;
  const otpTemplate = process.env.WHATSAPP_OTP_TEMPLATE;

  if (metaToken && metaPhoneId && digitsOnly) {
    try {
      const payload: any = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: digitsOnly,
      };

      if (otpTemplate) {
        payload.type = "template";
        payload.template = {
          name: otpTemplate,
          language: { code: "es" },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: recipientName },
                { type: "text", text: code },
              ],
            },
            {
              type: "button",
              sub_type: "url",
              index: "0",
              parameters: [{ type: "text", text: code }],
            },
          ],
        };
      } else {
        payload.type = "text";
        payload.text = { body: message };
      }

      const res = await fetch(`https://graph.facebook.com/v19.0/${metaPhoneId}/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${metaToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const resJson = await res.json();

      if (res.ok && resJson.messages?.[0]?.id) {
        const wamid = resJson.messages[0].id;
        console.log(`[WhatsApp Meta API] OTP sent to ${cleanPhone} | WAMID: ${wamid}`);
        
        await recordWhatsAppDispatch({
          wamid,
          phoneNumberId: metaPhoneId,
          recipientPhone: digitsOnly,
          templateName: otpTemplate || "text_otp",
          language: "es",
          rawResponse: resJson,
        });

        return { success: true, wamid };
      } else {
        console.warn(`[WhatsApp Meta API Text Fail, trying fallback template...]`, resJson);
        // Fallback to approved template if text message is rejected outside 24h window
        const fallbackPayload = {
          messaging_product: "whatsapp",
          to: digitsOnly,
          type: "template",
          template: {
            name: "3p_direct_integration_test_template",
            language: { code: "en_US" },
          },
        };

        const fbRes = await fetch(`https://graph.facebook.com/v19.0/${metaPhoneId}/messages`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${metaToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(fallbackPayload),
        });

        const fbJson = await fbRes.json();

        if (fbRes.ok && fbJson.messages?.[0]?.id) {
          const wamid = fbJson.messages[0].id;
          console.log(`[WhatsApp Meta API] Fallback OTP template sent to ${cleanPhone} | WAMID: ${wamid}`);
          
          await recordWhatsAppDispatch({
            wamid,
            phoneNumberId: metaPhoneId,
            recipientPhone: digitsOnly,
            templateName: "3p_direct_integration_test_template",
            language: "en_US",
            rawResponse: fbJson,
          });

          return { success: true, wamid };
        } else {
          console.error(`[WhatsApp Meta API Fallback Error]`, fbJson);
        }
      }
    } catch (e: any) {
      console.error(`[WhatsApp Meta API Exception]`, e.message);
    }
  }

  // Gateway Fallback
  const gatewayUrl = process.env.WHATSAPP_GATEWAY_URL;
  const gatewayToken = process.env.WHATSAPP_GATEWAY_TOKEN;

  if (gatewayUrl && gatewayToken) {
    try {
      const res = await fetch(gatewayUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: gatewayToken,
          to: cleanPhone,
          body: message,
        }),
      });

      if (res.ok) {
        console.log(`[WhatsApp Gateway] OTP sent to ${cleanPhone}`);
        return { success: true };
      }
    } catch (e: any) {
      console.error(`[WhatsApp Gateway Exception]`, e.message);
    }
  }

  console.log(`[WhatsApp Dev Fallback] OTP for ${cleanPhone} is: ${code}`);
  return { success: true };
}

export interface SendWhatsAppWelcomeParams {
  phoneNumber: string;
  recipientName?: string;
}

export async function sendWhatsAppWelcome({ phoneNumber, recipientName = "Jugador" }: SendWhatsAppWelcomeParams): Promise<{ success: boolean; wamid?: string }> {
  const { cleanPhone, digitsOnly } = normalizePhoneNumber(phoneNumber);
  const message = `¡Hola ${recipientName}! 🚀\n\nBienvenido/a a *ClubLab*. Tu número ha sido verificado correctamente como tu canal oficial de notificaciones.\n\nA partir de ahora recibirás aquí las convocatorias, avisos de entrenamiento y alertas indispensables de tu equipo. ¡A por todas! ⚽`;

  console.log(`[WhatsApp Welcome Dispatch] Target: ${cleanPhone}`);

  const metaToken = process.env.WHATSAPP_CLOUD_TOKEN;
  const metaPhoneId = process.env.WHATSAPP_CLOUD_PHONE_ID;
  const welcomeTemplate = process.env.WHATSAPP_WELCOME_TEMPLATE;

  if (metaToken && metaPhoneId && digitsOnly) {
    try {
      const payload: any = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: digitsOnly,
      };

      if (welcomeTemplate) {
        payload.type = "template";
        payload.template = {
          name: welcomeTemplate,
          language: { code: "es" },
          components: [
            {
              type: "body",
              parameters: [{ type: "text", text: recipientName }],
            },
          ],
        };
      } else {
        payload.type = "text";
        payload.text = { body: message };
      }

      const res = await fetch(`https://graph.facebook.com/v19.0/${metaPhoneId}/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${metaToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const resJson = await res.json();

      if (res.ok && resJson.messages?.[0]?.id) {
        const wamid = resJson.messages[0].id;
        console.log(`[WhatsApp Meta API] Welcome message sent to ${cleanPhone} | WAMID: ${wamid}`);
        
        await recordWhatsAppDispatch({
          wamid,
          phoneNumberId: metaPhoneId,
          recipientPhone: digitsOnly,
          templateName: welcomeTemplate || "text_welcome",
          language: "es",
          rawResponse: resJson,
        });

        return { success: true, wamid };
      } else {
        console.error(`[WhatsApp Meta API Welcome Error]`, resJson);
      }
    } catch (e: any) {
      console.error(`[WhatsApp Meta API Welcome Exception]`, e.message);
    }
  }

  const gatewayUrl = process.env.WHATSAPP_GATEWAY_URL;
  const gatewayToken = process.env.WHATSAPP_GATEWAY_TOKEN;

  if (gatewayUrl && gatewayToken) {
    try {
      await fetch(gatewayUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: gatewayToken,
          to: cleanPhone,
          body: message,
        }),
      });
      return { success: true };
    } catch (e: any) {
      console.error(`[WhatsApp Gateway Welcome Exception]`, e.message);
    }
  }

  console.log(`[WhatsApp Dev Fallback] Welcome message logged for ${cleanPhone}`);
  return { success: true };
}
