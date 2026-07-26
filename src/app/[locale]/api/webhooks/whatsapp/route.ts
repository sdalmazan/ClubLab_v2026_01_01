import { NextResponse, type NextRequest } from "next/server";
import crypto from "crypto";
import { updateWhatsAppMessageStatus } from "@/lib/whatsapp/service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const expectedVerifyToken = process.env.WHATSAPP_VERIFY_TOKEN || "clublab_wa_verify_2026";

  if (mode === "subscribe" && token === expectedVerifyToken) {
    console.log("[WhatsApp Webhook GET] Verification successful from Meta.");
    return new Response(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  console.warn("[WhatsApp Webhook GET] Verification failed. Token mismatch or mode invalid.");
  return NextResponse.json({ error: "Forbidden - Invalid verify token" }, { status: 403 });
}

function verifyMetaSignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return false;
  }
  const signature = signatureHeader.slice(7);
  const expectedHash = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex");

  return crypto.timingSafeEqual(Buffer.from(signature, "utf8"), Buffer.from(expectedHash, "utf8"));
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const appSecret = process.env.WHATSAPP_APP_SECRET;

    if (appSecret) {
      const signatureHeader = request.headers.get("x-hub-signature-256");
      const isValid = verifyMetaSignature(rawBody, signatureHeader, appSecret);
      if (!isValid) {
        console.error("[WhatsApp Webhook POST Error] Invalid X-Hub-Signature-256 header.");
        return NextResponse.json({ error: "Unauthorized signature" }, { status: 401 });
      }
    }

    const body = JSON.parse(rawBody);

    if (body.object === "whatsapp_business_account") {
      const entries = body.entry || [];

      for (const entry of entries) {
        const changes = entry.changes || [];

        for (const change of changes) {
          if (change.field === "messages") {
            const value = change.value || {};

            if (value.statuses && Array.isArray(value.statuses)) {
              for (const statusObj of value.statuses) {
                const wamid = statusObj.id;
                const status = statusObj.status;
                const timestamp = statusObj.timestamp;
                const recipientId = statusObj.recipient_id;

                let errorPayload = null;
                if (status === "failed" && statusObj.errors && statusObj.errors.length > 0) {
                  const primaryErr = statusObj.errors[0];
                  errorPayload = {
                    code: primaryErr.code,
                    title: primaryErr.title,
                    message: primaryErr.message,
                    details: primaryErr.error_data?.details || primaryErr.message || "Unknown Meta failure",
                  };
                }

                console.log(`[WhatsApp Status Event] WAMID: ${wamid} | Target: ${recipientId} | Status: ${status}`);

                await updateWhatsAppMessageStatus({
                  wamid,
                  status,
                  timestamp,
                  recipientId,
                  error: errorPayload,
                  rawWebhookEvent: statusObj,
                });
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ status: "SUCCESS" }, { status: 200 });
  } catch (error: any) {
    console.error("[WhatsApp Webhook POST Exception]", error.message);
    return NextResponse.json({ status: "ERROR_HANDLED", message: error.message }, { status: 200 });
  }
}
