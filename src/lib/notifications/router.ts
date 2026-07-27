import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmailAlert } from "@/lib/email/mailer";
import { normalizePhoneNumber, recordWhatsAppDispatch } from "@/lib/whatsapp/service";

export interface DispatchNotificationParams {
  playerId: string;
  title: string;
  body: string;
  actionUrl?: string;
  actionText?: string;
  metadata?: Record<string, any>;
}

export async function getPlayerNotificationSettings(playerId: string) {
  const adminSupabase = createAdminClient();
  const { data: player } = await adminSupabase
    .from("players")
    .select("id, email, phone_number, notification_channel, email_verified, whatsapp_verified, first_name, last_name")
    .eq("id", playerId)
    .limit(1)
    .maybeSingle();

  if (!player) return null;

  return {
    playerId: player.id,
    email: player.email,
    phoneNumber: player.phone_number,
    channel: (player.notification_channel || "email") as "email" | "whatsapp",
    emailVerified: !!player.email_verified,
    whatsappVerified: !!player.whatsapp_verified,
    fullName: [player.first_name, player.last_name].filter(Boolean).join(" ") || "Jugador",
  };
}

/**
 * Single source of truth for routing operational club notifications (convocatorias, schedules, alerts, etc.)
 */
export async function dispatchClubNotification({
  playerId,
  title,
  body,
  actionUrl,
  actionText = "Ver en ClubLab",
}: DispatchNotificationParams): Promise<{ success: boolean; channelUsed: "email" | "whatsapp"; error?: string }> {
  const settings = await getPlayerNotificationSettings(playerId);

  if (!settings) {
    return { success: false, channelUsed: "email", error: "Jugador no encontrado" };
  }

  const { channel, email, phoneNumber, fullName } = settings;

  // ROUTE TO WHATSAPP IF ACTIVE CHANNEL IS WHATSAPP AND PHONE IS PRESENT
  if (channel === "whatsapp" && phoneNumber) {
    try {
      const { cleanPhone, digitsOnly } = normalizePhoneNumber(phoneNumber);
      const metaToken = process.env.WHATSAPP_CLOUD_TOKEN;
      const metaPhoneId = process.env.WHATSAPP_CLOUD_PHONE_ID;

      if (metaToken && metaPhoneId) {
        const payload = {
          messaging_product: "whatsapp",
          to: digitsOnly,
          type: "text",
          text: {
            body: `[ClubLab - S.D. Almazán]\n*${title}*\n\n${body}${actionUrl ? `\n\nAcceder: ${actionUrl}` : ""}`,
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
        if (res.ok && resJson.messages?.[0]?.id) {
          await recordWhatsAppDispatch({
            wamid: resJson.messages[0].id,
            recipientPhone: digitsOnly,
            rawResponse: resJson,
          });
          return { success: true, channelUsed: "whatsapp" };
        }
      }
    } catch (err: any) {
      console.warn("[dispatchClubNotification] WhatsApp dispatch fallback to email:", err.message);
    }
  }

  // FALLBACK OR DIRECT ROUTE TO EMAIL
  if (email && email.includes("@")) {
    const success = await sendEmailAlert({
      to: email,
      recipientName: fullName,
      title,
      body,
      actionUrl,
      actionText,
    });
    return { success, channelUsed: "email" };
  }

  return { success: false, channelUsed: channel, error: "No contact info available" };
}

/**
 * Account Security and Identity Communications (password reset, critical security alerts, RGPD).
 * ALWAYS dispatched via EMAIL regardless of notification_channel setting.
 */
export async function dispatchAccountSecurityEmail({
  email,
  recipientName,
  title,
  body,
  actionUrl,
  actionText,
}: {
  email: string;
  recipientName?: string;
  title: string;
  body: string;
  actionUrl?: string;
  actionText?: string;
}) {
  return await sendEmailAlert({
    to: email,
    recipientName,
    title,
    body,
    actionUrl,
    actionText,
  });
}
