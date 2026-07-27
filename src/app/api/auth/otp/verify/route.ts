import { NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhoneNumber } from "@/lib/whatsapp/service";

export async function POST(request: Request) {
  try {
    const { identifier, code, channel = "email", purpose = "onboarding" } = await request.json();

    if (!identifier || !code || typeof code !== "string") {
      return NextResponse.json({ error: "Identificador y código OTP obligatorios." }, { status: 400 });
    }

    let cleanIdentifier = identifier.trim().toLowerCase();
    if (channel === "whatsapp") {
      const { digitsOnly } = normalizePhoneNumber(identifier);
      if (digitsOnly) cleanIdentifier = digitsOnly;
    }

    const cleanCode = code.trim();
    if (cleanCode.length !== 6 || !/^\d+$/.test(cleanCode)) {
      return NextResponse.json({ error: "El código OTP debe ser un número de 6 dígitos." }, { status: 400 });
    }

    const inputHash = crypto.createHash("sha256").update(cleanCode).digest("hex");
    const nowIso = new Date().toISOString();

    let recordFound: any = null;
    let isFromDb = false;

    try {
      const adminSupabase = createAdminClient();
      const { data: record } = await adminSupabase
        .from("auth_otp_codes")
        .select("*")
        .eq("identifier", cleanIdentifier)
        .eq("channel", channel)
        .eq("purpose", purpose)
        .is("verified_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (record) {
        recordFound = record;
        isFromDb = true;
      }
    } catch (e: any) {
      console.warn("[OTP Verify] DB fallback triggered:", e.message);
    }

    if (!recordFound) {
      return NextResponse.json({ error: "No se encontró un código OTP activo para este identificador. Por favor solicita uno nuevo." }, { status: 404 });
    }

    // Attempt lockout check (Max 5 attempts)
    if (recordFound.attempts_count >= 5) {
      if (isFromDb) {
        const adminSupabase = createAdminClient();
        await adminSupabase.from("auth_otp_codes").delete().eq("id", recordFound.id);
      }
      return NextResponse.json({ error: "Has superado el límite máximo de 5 intentos. El código ha sido bloqueado por seguridad. Solicita uno nuevo." }, { status: 429 });
    }

    // Expiration check (10 minutes)
    if (new Date(recordFound.expires_at).getTime() < Date.now()) {
      if (isFromDb) {
        const adminSupabase = createAdminClient();
        await adminSupabase.from("auth_otp_codes").delete().eq("id", recordFound.id);
      }
      return NextResponse.json({ error: "El código OTP ha expirado (válido 10 minutos). Solicita un nuevo código." }, { status: 400 });
    }

    // Compare Hash
    if (recordFound.otp_hash !== inputHash) {
      if (isFromDb) {
        const adminSupabase = createAdminClient();
        await adminSupabase
          .from("auth_otp_codes")
          .update({ attempts_count: (recordFound.attempts_count || 0) + 1 })
          .eq("id", recordFound.id);
      }
      const attemptsLeft = 5 - ((recordFound.attempts_count || 0) + 1);
      return NextResponse.json({
        error: `Código incorrecto. Quedan ${attemptsLeft} intento(s) antes de ser bloqueado.`,
      }, { status: 400 });
    }

    // MARK VERIFIED
    if (isFromDb) {
      const adminSupabase = createAdminClient();
      await adminSupabase
        .from("auth_otp_codes")
        .update({ verified_at: nowIso })
        .eq("id", recordFound.id);
    }

    return NextResponse.json({
      success: true,
      identifier: cleanIdentifier,
      channel,
      verifiedAt: nowIso,
      message: "Código OTP verificado correctamente.",
    });
  } catch (err: any) {
    console.error("[POST /api/auth/otp/verify] Error:", err);
    return NextResponse.json({ error: err.message || "Error al verificar OTP." }, { status: 500 });
  }
}
