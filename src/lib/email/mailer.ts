import nodemailer from "nodemailer";

const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
const smtpPort = Number(process.env.SMTP_PORT || "465");
const smtpSecure = process.env.SMTP_SECURE !== "false";
const smtpUser = process.env.SMTP_USER || "clublab.notifications@gmail.com";
const smtpPass = process.env.SMTP_PASS || "isln miyf ysws ffec";

const defaultFrom = process.env.EMAIL_FROM || `"ClubLab Notificaciones" <${smtpUser}>`;
const defaultReplyTo = process.env.EMAIL_REPLY_TO || "no-reply@clublab.app";

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpSecure,
  auth: {
    user: smtpUser,
    pass: smtpPass,
  },
});

export interface SendEmailAlertParams {
  to: string;
  recipientName?: string;
  title: string;
  body: string;
  actionUrl?: string;
  actionText?: string;
}

export async function sendEmailAlert({
  to,
  recipientName,
  title,
  body,
  actionUrl,
  actionText = "Ver Alerta en ClubLab",
}: SendEmailAlertParams) {
  if (!to || !to.includes("@")) {
    console.warn("[sendEmailAlert] Skipped: Invalid recipient email", to);
    return false;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const targetUrl = actionUrl
    ? actionUrl.startsWith("http")
      ? actionUrl
      : `${appUrl}${actionUrl}`
    : appUrl;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #090d16; color: #e2e8f0; margin: 0; padding: 24px; }
        .card { max-width: 560px; margin: 0 auto; background-color: #111827; border: 1px solid #1e293b; border-radius: 16px; padding: 32px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5); }
        .logo { font-size: 20px; font-weight: 800; color: #3b82f6; letter-spacing: -0.5px; margin-bottom: 24px; display: inline-block; }
        .logo span { color: #ffffff; }
        .badge { display: inline-block; background-color: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 4px 10px; border-radius: 9999px; margin-bottom: 16px; }
        h2 { color: #f8fafc; font-size: 20px; margin: 0 0 12px 0; font-weight: 700; }
        p { color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0; }
        .btn-container { margin: 28px 0 20px 0; text-align: left; }
        .btn { display: inline-block; background-color: #2563eb; color: #ffffff !important; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 24px; border-radius: 10px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3); }
        .footer { margin-top: 32px; border-top: 1px solid #1e293b; padding-top: 20px; font-size: 11px; color: #64748b; text-align: center; }
        .footer a { color: #64748b; text-decoration: underline; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">Club<span>Lab</span></div>
        <br />
        <div class="badge">🔔 Alerta / Aviso de la App</div>
        <h2>${title}</h2>
        <p>Hola ${recipientName || "usuario"},</p>
        <p>${body.replace(/\n/g, "<br>")}</p>
        
        <div class="btn-container">
          <a href="${targetUrl}" class="btn" target="_blank">${actionText} &rarr;</a>
        </div>
        
        <div class="footer">
          Este aviso fue generado automáticamente por la plataforma <strong>ClubLab</strong>.<br />
          No respondas directamente a este correo.
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const info = await transporter.sendMail({
      from: defaultFrom,
      to,
      replyTo: defaultReplyTo,
      subject: `[ClubLab] ${title}`,
      text: `${title}\n\n${body}\n\nAcceder a la alerta: ${targetUrl}`,
      html: htmlContent,
    });

    console.log(`[sendEmailAlert] Email sent successfully to ${to} (MessageID: ${info.messageId})`);
    return true;
  } catch (error: any) {
    console.error(`[sendEmailAlert] Failed to send email to ${to}:`, error.message);
    return false;
  }
}

export interface SendPlayerInvitationParams {
  to: string;
  recipientName: string;
  invitationUrl: string;
  orgName?: string;
  roleName?: string;
}

export async function sendPlayerInvitationEmail({
  to,
  recipientName,
  invitationUrl,
  orgName = "tu club",
  roleName = "Jugador",
}: SendPlayerInvitationParams) {
  if (!to || !to.includes("@")) {
    console.warn("[sendPlayerInvitationEmail] Skipped: Invalid recipient email", to);
    return false;
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Invitación a ClubLab</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #090d16; color: #e2e8f0; margin: 0; padding: 24px; }
        .card { max-width: 560px; margin: 0 auto; background-color: #111827; border: 1px solid #1e293b; border-radius: 16px; padding: 32px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5); }
        .logo { font-size: 22px; font-weight: 800; color: #3b82f6; letter-spacing: -0.5px; margin-bottom: 24px; display: inline-block; }
        .logo span { color: #ffffff; }
        .badge { display: inline-block; background-color: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 4px 10px; border-radius: 9999px; margin-bottom: 16px; }
        h2 { color: #f8fafc; font-size: 22px; margin: 0 0 12px 0; font-weight: 700; }
        p { color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0; }
        .btn-container { margin: 28px 0 20px 0; text-align: left; }
        .btn { display: inline-block; background-color: #10b981; color: #ffffff !important; font-size: 14px; font-weight: 600; text-decoration: none; padding: 14px 28px; border-radius: 10px; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35); }
        .footer { margin-top: 32px; border-top: 1px solid #1e293b; padding-top: 20px; font-size: 11px; color: #64748b; text-align: center; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">Club<span>Lab</span></div>
        <br />
        <div class="badge">📩 Invitación Oficial</div>
        <h2>¡Te han invitado a unirte a ${orgName}!</h2>
        <p>Hola <strong>${recipientName}</strong>,</p>
        <p>Has recibido una invitación para darte de alta en la plataforma <strong>ClubLab</strong> con el rol de <strong>${roleName}</strong>.</p>
        <p>Al registrarte, tu cuenta se vinculará automáticamente con tu ficha en la plantilla del club y podrás acceder a tus entrenamientos, cuestionarios wellness y análisis.</p>
        
        <div class="btn-container">
          <a href="${invitationUrl}" class="btn" target="_blank">Completar Registro en ClubLab &rarr;</a>
        </div>
        
        <p style="font-size: 12px; color: #64748b;">* Al registrarte, aceptarás nuestra política de privacidad de datos para vincular tu perfil de deportista.</p>
        
        <div class="footer">
          Mensaje automático enviado desde la plataforma <strong>ClubLab</strong>.<br />
          No respondas directamente a este correo.
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const info = await transporter.sendMail({
      from: defaultFrom,
      to,
      replyTo: defaultReplyTo,
      subject: `[ClubLab] Invitación para unirte a ${orgName}`,
      text: `Hola ${recipientName},\n\nHas recibido una invitación para unirte a ${orgName} como ${roleName} en ClubLab.\n\nCompleta tu alta en: ${invitationUrl}`,
      html: htmlContent,
    });

    console.log(`[sendPlayerInvitationEmail] Email sent to ${to} (ID: ${info.messageId})`);
    return true;
  } catch (error: any) {
    console.error(`[sendPlayerInvitationEmail] Failed to send to ${to}:`, error.message);
    return false;
  }
}

