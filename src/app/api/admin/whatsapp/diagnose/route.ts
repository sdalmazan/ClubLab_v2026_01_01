import { NextResponse, type NextRequest } from "next/server";
import { normalizePhoneNumber, recordWhatsAppDispatch, getWhatsAppMessageStatus } from "@/lib/whatsapp/service";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/whatsapp/diagnose?wamid=xxx
 * Retrieves full tracking status for a given WAMID.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const wamid = searchParams.get("wamid");

  if (!wamid) {
    return NextResponse.json({ error: "Missing wamid query parameter." }, { status: 400 });
  }

  const record = await getWhatsAppMessageStatus(wamid);

  if (!record) {
    return NextResponse.json({
      wamid,
      found: false,
      message: "No tracking record found for this WAMID yet.",
    }, { status: 404 });
  }

  return NextResponse.json({
    wamid: record.wamid,
    found: true,
    initialStatus: record.initial_status,
    currentStatus: record.current_status,
    recipient: record.recipient_phone,
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
 * Sends a diagnostic test message and returns the tracked WAMID immediately.
 */
export async function POST(request: Request) {
  try {
    const { phoneNumber = "34685284495", templateName = "3p_direct_integration_test_template", language = "en_US" } = await request.json();

    const { cleanPhone, digitsOnly } = normalizePhoneNumber(phoneNumber);

    const metaToken = process.env.WHATSAPP_CLOUD_TOKEN;
    const metaPhoneId = process.env.WHATSAPP_CLOUD_PHONE_ID;
    const wabaId = process.env.WHATSAPP_WABA_ID || "1635059935292068";

    if (!metaToken || !metaPhoneId) {
      return NextResponse.json({ error: "WHATSAPP_CLOUD_TOKEN or WHATSAPP_CLOUD_PHONE_ID not set in environment." }, { status: 500 });
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
        "Authorization": `Bearer ${metaToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const resJson = await res.json();

    if (!res.ok || !resJson.messages?.[0]?.id) {
      return NextResponse.json({
        success: false,
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
      rawResponse: resJson,
    });

    return NextResponse.json({
      success: true,
      wamid,
      initialStatus: "accepted",
      recipient: digitsOnly,
      templateName,
      language,
      trackingUrl: `/api/admin/whatsapp/diagnose?wamid=${encodeURIComponent(wamid)}`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
