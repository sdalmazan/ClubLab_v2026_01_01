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
  orgName = "SD Almazán",
  roleName = "Jugador",
}: SendPlayerInvitationParams) {
  if (!to || !to.includes("@")) {
    console.warn("[sendPlayerInvitationEmail] Skipped: Invalid recipient email", to);
    return false;
  }

  const plainText = `¡Hola ${recipientName}!\n\nHas recibido una invitación oficial para darte de alta en ${orgName} como ${roleName} en ClubLab.\n\nHaz clic o copia el siguiente enlace en tu navegador para completar tu registro:\n${invitationUrl}\n\n⚠️ Si has recibido este correo en tu carpeta de SPAM, por favor márcalo como 'No es SPAM' para recibir futuras notificaciones.\n\nSoporte: Diego Ciria (+34 6852 284 495)\n\nUn saludo,\nEquipo de ClubLab`;

  const isPlayer = roleName.toLowerCase().includes("jugador") || roleName.toLowerCase().includes("player");

  const featuresList = isPlayer
    ? `
      <li style="margin-bottom: 8px;"><strong>Convocatorias y Calendario:</strong> Consulta tus horarios de entrenamiento y partidos.</li>
      <li style="margin-bottom: 8px;"><strong>Ejercicios y Rendimiento:</strong> Asignación de ejercicios, seguimiento de estado físico y rendimiento.</li>
      <li style="margin-bottom: 8px;"><strong>Control Diario:</strong> Cuestionarios rápidos de Wellness/RPE para ayudar al staff a ajustar tu carga.</li>
    `
    : `
      <li style="margin-bottom: 8px;"><strong>Cuerpo Técnico:</strong> Planificación de sesiones, tareas, partidos y análisis táctico.</li>
      <li style="margin-bottom: 8px;"><strong>Preparación Física:</strong> Control de cargas, monitorización de fatiga y rutinas de rendimiento.</li>
      <li style="margin-bottom: 8px;"><strong>Servicios Médicos:</strong> Partes de lesiones, seguimiento de rehabilitación y control de bajas.</li>
      <li style="margin-bottom: 8px;"><strong>Dirección / Coordinación:</strong> Visión global de plantillas, alertas de cantera e informes de scouting.</li>
    `;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Invitación a ClubLab - ${orgName}</title>
    </head>
    <body style="margin: 0; padding: 24px 12px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
      
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px 24px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <tr>
          <td>
            <!-- CABECERA -->
            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px;">
              <tr>
                <td>
                  <h1 style="color: #0f172a; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Bienvenido/a a ClubLab</h1>
                  <p style="color: #64748b; margin: 4px 0 0 0; font-size: 14px;">Invitación oficial de <strong>${orgName}</strong></p>
                </td>
              </tr>
            </table>

            <!-- AVISO IMPORTANTE: REVISAR CARPETA DE SPAM -->
            <div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 14px 16px; margin-bottom: 24px;">
              <strong style="color: #be123c; font-size: 13px; display: block; margin-bottom: 4px;">⚠️ ¿Este correo te ha llegado a la carpeta de SPAM?</strong>
              <p style="font-size: 13px; line-height: 1.5; color: #9f1239; margin: 0;">
                Si has recibido este mensaje en la carpeta de SPAM o Correo No Deseado, por favor márcalo como <strong>"No es SPAM"</strong> o añade nuestro remitente a tus contactos para no perderte convocatorias, avisos ni notificaciones del club.
              </p>
            </div>

            <!-- SALUDO E INTRODUCCIÓN -->
            <p style="font-size: 15px; line-height: 1.6; color: #1e293b; margin-bottom: 14px;">
              Hola, <strong>${recipientName}</strong>:
            </p>
            <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 24px;">
              Has recibido una invitación oficial para unirte a la plataforma de <strong>${orgName}</strong> en ClubLab con el rol de <strong>${roleName}</strong>.
            </p>

            <!-- DESTACADO: RIGOR EN LOS DATOS -->
            <div style="background-color: #f1f5f9; border-left: 4px solid #2563eb; padding: 16px 20px; border-radius: 0 8px 8px 0; margin-bottom: 28px;">
              <strong style="color: #0f172a; font-size: 12px; display: block; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.8px;">La clave del éxito: Rigor en el uso</strong>
              <p style="font-size: 14px; line-height: 1.5; color: #475569; margin: 0;">
                El valor de esta herramienta depende de la constancia y precisión con la que registremos la información diaria. El rigor en los datos nos permite prevenir lesiones, ajustar cargas de trabajo y optimizar el rendimiento.
              </p>
            </div>

            <!-- MÓDULOS DEL PERFIL -->
            <h3 style="color: #0f172a; font-size: 15px; font-weight: 700; margin-bottom: 14px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Tus módulos en la plataforma</h3>
            
            <ul style="padding-left: 20px; margin: 0 0 28px 0; font-size: 14px; line-height: 1.7; color: #334155;">
              ${featuresList}
            </ul>

            <!-- BLOQUE: APLICACIÓN WEB Y ACCESO DIRECTO -->
            <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin-bottom: 28px;">
              <h4 style="color: #1e40af; margin: 0 0 8px 0; font-size: 15px; font-weight: 700;">📱 Aplicación Web y Acceso Directo Móvil</h4>
              <p style="font-size: 14px; line-height: 1.5; color: #1e3a8a; margin: 0 0 14px 0;">
                ClubLab es una <strong>aplicación web</strong> accesible desde cualquier navegador. Puedes añadir un acceso directo en la pantalla de inicio de tu teléfono para utilizarla como una app nativa:
              </p>
              <div style="background: #ffffff; padding: 12px 14px; border-radius: 6px; border: 1px solid #dbeafe; font-size: 13px; color: #1e293b; margin-bottom: 10px;">
                <strong> iPhone / iOS (Safari):</strong> Abra la página en Safari &rarr; pulse <strong>Compartir</strong> (cuadrado con flecha arriba) &rarr; seleccione <strong>"Añadir a la pantalla de inicio"</strong>.
              </div>
              <div style="background: #ffffff; padding: 12px 14px; border-radius: 6px; border: 1px solid #dbeafe; font-size: 13px; color: #1e293b;">
                <strong>🤖 Android (Chrome):</strong> Abra la página en Chrome &rarr; pulse los <strong>3 puntos superiores</strong> &rarr; seleccione <strong>"Añadir a pantalla de inicio"</strong>.
              </div>
            </div>

            <!-- BOTÓN DE ACCIÓN (CTA) -->
            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 32px 0;">
              <tr>
                <td align="center">
                  <a href="${invitationUrl}" target="_blank" style="background-color: #2563eb; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px; display: inline-block; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);">Completar Registro en ClubLab &rarr;</a>
                </td>
              </tr>
            </table>

            <p style="font-size:12px; color:#64748b; margin:16px 0; text-align:center;">Si el botón no funciona, copia y pega este enlace en tu navegador:<br><a href="${invitationUrl}" style="color:#2563eb; text-decoration:underline; word-break:break-all;">${invitationUrl}</a></p>

            <!-- PIE DE PÁGINA Y CONTACTO -->
            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-top: 1px solid #f1f5f9; padding-top: 20px; font-size: 13px; color: #64748b;">
              <tr>
                <td>
                  <p style="margin: 0 0 4px 0; color: #0f172a;"><strong>¿Tienes alguna duda o incidencia?</strong></p>
                  <p style="margin: 0;">Contacta con <strong>Diego Ciria</strong> | 📞 <strong>+34 6852 284 495</strong></p>
                </td>
              </tr>
            </table>

          </td>
        </tr>
      </table>

    </body>
    </html>
  `;

  try {
    const info = await transporter.sendMail({
      from: defaultFrom,
      to,
      replyTo: defaultReplyTo,
      subject: `[ClubLab] Invitación oficial para unirte a ${orgName}`,
      text: plainText,
      html: htmlContent,
    });

    console.log(`[sendPlayerInvitationEmail] Email sent to ${to} (ID: ${info.messageId})`);
    return true;
  } catch (error: any) {
    console.error(`[sendPlayerInvitationEmail] Failed to send to ${to}:`, error.message);
    return false;
  }
}

export async function sendRegistrationConfirmationEmail({
  to,
  recipientName,
  orgName = "SD Almazán",
  preferredChannel = "email",
}: {
  to: string;
  recipientName: string;
  orgName?: string;
  preferredChannel?: string;
}) {
  if (!to || !to.includes("@")) return false;

  const isWhatsapp = preferredChannel === "whatsapp";
  const channelText = isWhatsapp ? "WhatsApp" : "Correo Electrónico";

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://clublab.vercel.app";

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <title>Registro completado en ClubLab</title>
    </head>
    <body style="margin: 0; padding: 24px 12px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px 24px;">
        <tr>
          <td>
            <div style="font-size: 22px; font-weight: 800; color: #2563eb; margin-bottom: 16px;">
              Club<span style="color: #0f172a;">Lab</span>
            </div>
            
            <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; color: #047857; font-size: 13px; font-weight: 700; padding: 10px 14px; border-radius: 8px; margin-bottom: 20px;">
              ✅ ¡Tu cuenta en ${orgName} ha sido activada con éxito!
            </div>

            <p style="font-size: 15px; color: #1e293b; line-height: 1.6; margin-bottom: 16px;">
              Hola, <strong>${recipientName}</strong>:
            </p>

            <p style="font-size: 14px; color: #334155; line-height: 1.6; margin-bottom: 20px;">
              Te confirmamos que tu perfil de <strong>Jugador</strong> ha quedado oficialmente vinculado a la plantilla de <strong>${orgName}</strong> en la plataforma ClubLab.
            </p>

            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; margin-bottom: 24px; font-size: 13px; color: #475569;">
              📲 <strong>Canal de notificaciones configurado:</strong> ${channelText}<br>
              A partir de este momento recibirás convocatorias, avisos de entrenamiento y recordatorios por este canal.
            </div>

            <div style="text-align: center; margin: 28px 0;">
              <a href="${appUrl}/player" target="_blank" style="background-color: #2563eb; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 28px; border-radius: 8px; display: inline-block;">
                Entrar a Mi Perfil de Jugador &rarr;
              </a>
            </div>

            <div style="border-top: 1px solid #f1f5f9; padding-top: 16px; font-size: 12px; color: #64748b;">
              ¿Sugerencias o incidencias? Contacta con <strong>Diego Ciria</strong> (+34 6852 284 495).
            </div>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: defaultFrom,
      to,
      replyTo: defaultReplyTo,
      subject: `[ClubLab] Alta confirmada en ${orgName}`,
      text: `¡Hola ${recipientName}!\n\nTu cuenta de jugador en ${orgName} ha sido activada correctamente.\nCanal de notificaciones: ${channelText}.\n\nAccede a tu perfil: ${appUrl}/player`,
      html: htmlContent,
    });
    return true;
  } catch (err: any) {
    console.error("[sendRegistrationConfirmationEmail] Error:", err.message);
    return false;
  }
}


