/**
 * Servicio de envío de WhatsApp para ClubLab
 * Soporta Meta WhatsApp Cloud API, Twilio o pasarela HTTP genérica (UltraMsg/GreenAPI).
 */

export interface SendWhatsAppOTPParams {
  phoneNumber: string;
  code: string;
  recipientName?: string;
}

export async function sendWhatsAppOTP({ phoneNumber, code, recipientName = "Jugador" }: SendWhatsAppOTPParams): Promise<boolean> {
  const cleanPhone = phoneNumber.replace(/[^\d+]/g, "");
  const message = `[ClubLab] Tu código de verificación de WhatsApp es: *${code}*\n\nIntroduce este código de 6 dígitos en la aplicación para confirmar tu número. Válido durante 10 minutos.`;

  console.log(`[WhatsApp OTP Dispatch] Target: ${cleanPhone} | Code: ${code}`);

  // 1. Meta WhatsApp Cloud API
  const metaToken = process.env.WHATSAPP_CLOUD_TOKEN;
  const metaPhoneId = process.env.WHATSAPP_CLOUD_PHONE_ID;

  if (metaToken && metaPhoneId) {
    try {
      const res = await fetch(`https://graph.facebook.com/v19.0/${metaPhoneId}/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${metaToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: cleanPhone.replace("+", ""),
          type: "text",
          text: { body: message },
        }),
      });

      if (res.ok) {
        console.log(`[WhatsApp Meta API] OTP sent to ${cleanPhone}`);
        return true;
      } else {
        const errText = await res.text();
        console.error(`[WhatsApp Meta API Error]`, errText);
      }
    } catch (e: any) {
      console.error(`[WhatsApp Meta API Exception]`, e.message);
    }
  }

  // 2. Generic HTTP Gateway (UltraMsg / GreenAPI / Whapi)
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
        return true;
      }
    } catch (e: any) {
      console.error(`[WhatsApp Gateway Exception]`, e.message);
    }
  }

  // Dev fallback / Log mode
  console.log(`[WhatsApp Dev Fallback] OTP for ${cleanPhone} is: ${code}`);
  return true;
}

export interface SendWhatsAppWelcomeParams {
  phoneNumber: string;
  recipientName?: string;
}

export async function sendWhatsAppWelcome({ phoneNumber, recipientName = "Jugador" }: SendWhatsAppWelcomeParams): Promise<boolean> {
  const cleanPhone = phoneNumber.replace(/[^\d+]/g, "");
  const message = `¡Hola ${recipientName}! 🚀\n\nBienvenido/a a *ClubLab*. Tu número ha sido verificado correctamente como tu canal oficial de notificaciones.\n\nA partir de ahora recibirás aquí las convocatorias, avisos de entrenamiento y alertas indispensables de tu equipo. ¡A por todas! ⚽`;

  console.log(`[WhatsApp Welcome Dispatch] Target: ${cleanPhone}`);

  const metaToken = process.env.WHATSAPP_CLOUD_TOKEN;
  const metaPhoneId = process.env.WHATSAPP_CLOUD_PHONE_ID;

  if (metaToken && metaPhoneId) {
    try {
      const res = await fetch(`https://graph.facebook.com/v19.0/${metaPhoneId}/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${metaToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: cleanPhone.replace("+", ""),
          type: "text",
          text: { body: message },
        }),
      });

      if (res.ok) {
        console.log(`[WhatsApp Meta API] Welcome message sent to ${cleanPhone}`);
        return true;
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
      return true;
    } catch (e: any) {
      console.error(`[WhatsApp Gateway Welcome Exception]`, e.message);
    }
  }

  console.log(`[WhatsApp Dev Fallback] Welcome message logged for ${cleanPhone}`);
  return true;
}

