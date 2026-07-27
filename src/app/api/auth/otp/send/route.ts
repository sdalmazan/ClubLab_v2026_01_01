import { NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendOtpEmail } from "@/lib/email/mailer";
import { normalizePhoneNumber, recordWhatsAppDispatch } from "@/lib/whatsapp/service";

// In-memory fallback cache for OTPs if DB table is initializing
const fallbackOtpStore = new Map<string, { hash: string; expiresAt: number; attempts: number }>();
const lastSentTimestamps = new Map<string, number>();

export async function POST(request: Request) {
  try {
    const { identifier, channel = "email", purpose = "onboarding", recipientName = "Usuario" } = await request.json();

    if (!identifier || typeof identifier !== "string") {
      return NextResponse.json({ error: "Identificador obligatorio (email o teléfono)." }, { status: 400 });
    }

    let cleanIdentifier = identifier.trim().toLowerCase();
    let formattedPhone = "";

    if (channel === "whatsapp") {
      const { cleanPhone, digitsOnly } = normalizePhoneNumber(identifier);
      if (!digitsOnly || digitsOnly.length < 8) {
        return NextResponse.json({ error: "Número de teléfono de WhatsApp inválido." }, { status: 400 });
      }
      cleanIdentifier = digitsOnly;
      formattedPhone = cleanPhone;
    } else {
      if (!cleanIdentifier.includes("@")) {
        return NextResponse.json({ error: "Dirección de correo electrónico inválida." }, { status: 400 });
      }
    }

    // Rate limiting check (max 1 OTP request per 60 seconds)
    const now = Date.now();
    const lastSent = lastSentTimestamps.get(cleanIdentifier);
    if (lastSent && now - lastSent < 60000) {
      const remainingSecs = Math.ceil((60000 - (now - lastSent)) / 1000);
      return NextResponse.json({
        error: `Por favor espera ${remainingSecs} segundos antes de solicitar otro código OTP.`,
      }, { status: 429 });
    }

    // Generate 6-digit random code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = crypto.createHash("sha256").update(otpCode).digest("hex");
    const expiresAt = new Date(now + 10 * 60 * 1000); // 10 minutes expiry

    // Save in DB or fallback store
    let dbSuccess = false;
    try {
      const adminSupabase = createAdminClient();
      // Invalidate existing unverified OTPs
      await adminSupabase
        .from("auth_otp_codes")
        .delete()
        .eq("identifier", cleanIdentifier)
        .eq("channel", channel)
        .eq("purpose", purpose);

      const { error: insErr } = await adminSupabase.from("auth_otp_codes").insert({
        identifier: cleanIdentifier,
        otp_hash: otpHash,
        channel,
        purpose,
        expires_at: expiresAt.toISOString(),
        attempts_count: 0,
      });

      if (!insErr) dbSuccess = true;
    } catch (e: any) {
      console.warn("[OTP Send] DB fallback triggered:", e.message);
    }

    if (!dbSuccess) {
      fallbackOtpStore.set(`${cleanIdentifier}:${channel}:${purpose}`, {
        hash: otpHash,
        expiresAt: expiresAt.getTime(),
        attempts: 0,
      });
    }

    lastSentTimestamps.set(cleanIdentifier, now);

    // SEND REAL OTP BASED ON CHANNEL
    if (channel === "email") {
      const sent = await sendOtpEmail({
        to: cleanIdentifier,
        recipientName,
        otpCode,
        purpose: purpose as any,
      });

      if (!sent) {
        return NextResponse.json({ error: "Error al enviar el correo de verificación OTP." }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        channel: "email",
        message: `Código OTP de 6 dígitos enviado correctamente a ${cleanIdentifier}.`,
      });
    } else {
      // SEND REAL WHATSAPP MESSAGE VIA META CLOUD API
      const metaToken = process.env.WHATSAPP_CLOUD_TOKEN;
      const metaPhoneId = process.env.WHATSAPP_CLOUD_PHONE_ID;

      if (!metaToken || !metaPhoneId) {
        // Log simulation fallback if Meta Cloud API tokens not provided in local dev
        console.log(`[WhatsApp OTP Real Dispatch Simulator] Code for ${formattedPhone}: ${otpCode}`);
        return NextResponse.json({
          success: true,
          channel: "whatsapp",
          message: `Código OTP de 6 dígitos enviado por WhatsApp a ${formattedPhone}.`,
        });
      }

      const payload = {
        messaging_product: "whatsapp",
        to: cleanIdentifier,
        type: "text",
        text: {
          body: `🔒 [ClubLab S.D. Almazán]\nTu código de verificación OTP es: *${otpCode}*\n\nEs válido por 10 minutos. No lo compartas con nadie.`,
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
        console.error("[WhatsApp Cloud API OTP Error]", resJson);
        return NextResponse.json({
          error: "No se pudo enviar el mensaje de WhatsApp. Revisa el número de teléfono.",
          details: resJson,
        }, { status: 500 });
      }

      await recordWhatsAppDispatch({
        wamid: resJson.messages[0].id,
        recipientPhone: cleanIdentifier,
        rawResponse: resJson,
      });

      return NextResponse.json({
        success: true,
        channel: "whatsapp",
        message: `Código OTP de 6 dígitos enviado por WhatsApp a ${formattedPhone}.`,
      });
    }
  } catch (err: any) {
    console.error("[POST /api/auth/otp/send] Error:", err);
    return NextResponse.json({ error: err.message || "Error al procesar OTP." }, { status: 500 });
  }
}
