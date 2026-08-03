import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  normalizePhoneNumber,
  maskPhoneNumber,
  recordWhatsAppDispatch,
  getWhatsAppMessageStatus,
  auditWhatsAppTokenConfig,
} from "@/lib/whatsapp/service";

export const dynamic = "force-dynamic";

async function isUserAdmin(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return false;

    const adminSupabase = createAdminClient();
    const { data: orgRole } = await adminSupabase
      .from("user_organization_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    return ["super_admin", "club_admin"].includes(orgRole?.role || "");
  } catch {
    return false;
  }
}

/**
 * GET /api/admin/whatsapp/diagnose?wamid=xxx
 * GET /api/admin/whatsapp/diagnose?action=config
 * Protected Endpoint for WhatsApp Cloud API E2E status tracking & configuration audit.
 */
export async function GET(request: NextRequest) {
  const isAdmin = await isUserAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "No autorizado. Se requieren permisos de administración." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const wamid = searchParams.get("wamid");
  const action = searchParams.get("action");

  if (action === "config" || !wamid) {
    const configAudit = await auditWhatsAppTokenConfig();
    return NextResponse.json({
      type: "whatsapp_config_audit",
      config: configAudit,
    });
  }

  const record = await getWhatsAppMessageStatus(wamid);

  if (!record) {
    return NextResponse.json({
      wamid,
      found: false,
      message: "No se encontró ningún registro de rastreo para este WAMID.",
    }, { status: 404 });
  }

  // Determine Scenario Classification (Caso A, B, C, D, E)
  let scenario = "CASO_D_DISPATCH_REQUESTED_NO_WEBHOOK";
  let scenarioTitle = "Caso D: Petición API aceptada pero ningún Webhook recibido aún";

  if (record.current_status === "delivered" || record.current_status === "read") {
    scenario = "CASO_A_DELIVERED";
    scenarioTitle = "Caso A: Mensaje entregado correctamente en el dispositivo del usuario";
  } else if (record.current_status === "failed") {
    scenario = "CASO_B_FAILED_META_ERROR";
    scenarioTitle = `Caso B: Fallo posterior de Meta con código ${record.error_code || "Desconocido"}`;
  } else if (record.current_status === "sent") {
    scenario = "CASO_C_SENT_WAITING_DELIVERY";
    scenarioTitle = "Caso C: Enviado por Meta pero aún no verificado como entregado";
  }

  return NextResponse.json({
    wamid: record.wamid,
    found: true,
    scenario,
    scenarioTitle,
    initialStatus: record.initial_status,
    currentStatus: record.current_status,
    purpose: record.purpose || "onboarding",
    recipientMasked: maskPhoneNumber(record.recipient_phone),
    phoneId: record.phone_number_id,
    wabaId: record.waba_id,
    templateName: record.template_name,
    language: record.language,
    timestamps: {
      created: record.created_at,
      updated: record.updated_at,
      sent: record.sent_at,
      delivered: record.delivered_at,
      read: record.read_at,
      failed: record.failed_at,
    },
    error: record.error_code ? {
      code: record.error_code,
      title: record.error_title,
      message: record.error_message,
      details: record.error_details,
    } : null,
    rawInitialResponse: record.raw_initial_response,
    rawLastWebhookEvent: record.raw_last_webhook_event,
  });
}

/**
 * POST /api/admin/whatsapp/diagnose
 * Protected Endpoint to send a direct diagnostic test message and record WAMID.
 */
export async function POST(request: Request) {
  const isAdmin = await isUserAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "No autorizado. Se requieren permisos de administración." }, { status: 403 });
  }

  try {
    const { phoneNumber = "34685284495", templateName = "3p_direct_integration_test_template", language = "en_US" } = await request.json();

    const { cleanPhone, digitsOnly } = normalizePhoneNumber(phoneNumber);
    const maskedPhone = maskPhoneNumber(cleanPhone);

    const metaToken = process.env.WHATSAPP_CLOUD_TOKEN;
    const metaPhoneId = process.env.WHATSAPP_CLOUD_PHONE_ID;
    const wabaId = process.env.WHATSAPP_WABA_ID || "1635059935292068";

    if (!metaToken || !metaPhoneId) {
      return NextResponse.json({
        success: false,
        scenario: "CASO_E_GRAPH_API_ERROR",
        error: "WHATSAPP_CLOUD_TOKEN o WHATSAPP_CLOUD_PHONE_ID no configurado en entorno Vercel/Local.",
      }, { status: 500 });
    }

    const payload = {
      messaging_product: "whatsapp",
      to: digitsOnly,
      type: "template",
      template: {
        name: templateName,
        language: { code: language },
      },
    };

    const res = await fetch(`https://graph.facebook.com/v19.0/${metaPhoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${metaToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const resJson = await res.json();

    if (!res.ok || !resJson.messages?.[0]?.id) {
      return NextResponse.json({
        success: false,
        scenario: "CASO_E_GRAPH_API_ERROR",
        httpStatus: res.status,
        metaError: resJson,
      }, { status: res.status >= 400 && res.status < 600 ? res.status : 500 });
    }

    const wamid = resJson.messages[0].id;

    await recordWhatsAppDispatch({
      wamid,
      wabaId,
      phoneNumberId: metaPhoneId,
      recipientPhone: digitsOnly,
      templateName,
      language,
      purpose: "diagnostic_test",
      rawResponse: resJson,
    });

    return NextResponse.json({
      success: true,
      wamid,
      initialStatus: "dispatch_requested",
      recipientMasked: maskedPhone,
      templateName,
      language,
      trackingUrl: `/api/admin/whatsapp/diagnose?wamid=${encodeURIComponent(wamid)}`,
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      scenario: "CASO_E_GRAPH_API_ERROR",
      error: err.message,
    }, { status: 500 });
  }
}
