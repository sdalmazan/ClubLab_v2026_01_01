import { config } from "dotenv";
config({ path: ".env.local" });

import {
  normalizePhoneNumber,
  maskPhoneNumber,
  auditWhatsAppTokenConfig,
  recordWhatsAppDispatch,
  getWhatsAppMessageStatus,
} from "../src/lib/whatsapp/service";

async function main() {
  console.log("======================================================================");
  console.log("🔬 DIAGNÓSTICO END-TO-END DE ENTREGABILIDAD DE WHATSAPP CLOUD API");
  console.log("======================================================================");

  // 1. AUDITAR CONFIGURACIÓN DE TOKEN, WABA Y PHONE ID
  console.log("\n1. 🔑 Auditando Configuración de Credenciales y Meta Graph API...");
  const configAudit = await auditWhatsAppTokenConfig();

  console.log(`- Token Configurado: ${configAudit.tokenConfigured ? "✅ SÍ" : "❌ NO"}`);
  console.log(`- Preview de Token: ${configAudit.tokenPreview}`);
  console.log(`- Longitud del Token: ${configAudit.tokenLength} caracteres`);
  console.log(`- Phone Number ID: ${configAudit.phoneId}`);
  console.log(`- WABA ID: ${configAudit.wabaId}`);
  console.log(`- Webhook Verify Token: ${configAudit.verifyTokenConfigured ? "✅ Configurado" : "⚠️ Ausente"}`);
  console.log(`- App Secret: ${configAudit.appSecretConfigured ? "✅ Configurado" : "⚠️ Ausente"}`);

  console.log(`- Validación Live en Graph API (/v19.0/${configAudit.phoneId}): ${configAudit.graphApiValid ? "✅ VALIDO" : "❌ FALLÓ"}`);
  if (configAudit.graphPhoneDetails) {
    console.log(`  └─ Número Verificado Meta: ${configAudit.graphPhoneDetails.display_phone_number || "N/A"}`);
    console.log(`  └─ Nombre del Negocio: ${configAudit.graphPhoneDetails.verified_name || "N/A"}`);
    console.log(`  └─ Estado de Verificación: ${configAudit.graphPhoneDetails.code_verification_status || "N/A"}`);
    console.log(`  └─ Rating de Calidad: ${configAudit.graphPhoneDetails.quality_rating || "N/A"}`);
  }
  if (configAudit.metaError) {
    console.error(`  ❌ Error de Meta:`, JSON.stringify(configAudit.metaError, null, 2));
  }

  // 2. AUDITAR NORMALIZACIÓN Y ENMASCARAMIENTO DE NÚMERO DESTINATARIO
  const targetPhoneInput = "685284495";
  console.log(`\n2. 📱 Auditando Normalización y Anonimización del Teléfono (${targetPhoneInput})...`);
  const { cleanPhone, digitsOnly } = normalizePhoneNumber(targetPhoneInput);
  const maskedPhone = maskPhoneNumber(cleanPhone);

  console.log(`- Formato Entrante: "${targetPhoneInput}"`);
  console.log(`- Dígitos Sanitizados para Meta Graph API: "${digitsOnly}"`);
  console.log(`- Formato E.164: "${cleanPhone}"`);
  console.log(`- Formato Anonimizado para Logs Públicos: "${maskedPhone}"`);

  if (!digitsOnly || digitsOnly.length !== 11 || !digitsOnly.startsWith("34")) {
    console.error("❌ ERROR: La normalización del teléfono no produjo un número válido de 11 dígitos en España.");
    process.exit(1);
  }

  // 3. PRUEBA DIRECTA CONTRA META GRAPH API Y REGISTRO DE WAMID
  console.log(`\n3. 🚀 Ejecutando Prueba Directa contra Meta Graph API (3p_direct_integration_test_template)...`);

  const metaToken = process.env.WHATSAPP_CLOUD_TOKEN;
  const metaPhoneId = process.env.WHATSAPP_CLOUD_PHONE_ID;
  const wabaId = process.env.WHATSAPP_WABA_ID || "1635059935292068";

  if (!metaToken || !metaPhoneId) {
    console.error("❌ CASO E: Graph API Error - No hay token o Phone ID configurado.");
    process.exit(1);
  }

  const payload = {
    messaging_product: "whatsapp",
    to: digitsOnly,
    type: "template",
    template: {
      name: "3p_direct_integration_test_template",
      language: { code: "en_US" },
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
    console.error("❌ CASO E: Graph API Rechazó la petición.");
    console.error("HTTP Status:", res.status);
    console.error("Error Payload:", JSON.stringify(resJson, null, 2));
    process.exit(1);
  }

  const wamid = resJson.messages[0].id;
  console.log(`✅ Solicitud de envío ACEPTADA por Meta. HTTP Status: ${res.status}`);
  console.log(`📍 WAMID asignado: ${wamid}`);
  console.log(`📌 Estado interno inicial guardado: "dispatch_requested"`);

  await recordWhatsAppDispatch({
    wamid,
    wabaId,
    phoneNumberId: metaPhoneId,
    recipientPhone: digitsOnly,
    templateName: "3p_direct_integration_test_template",
    language: "en_US",
    purpose: "diagnostic_test",
    rawResponse: resJson,
  });

  // 4. CONSULTA DE RASTREO Y CLASIFICACIÓN DE ESCENARIO
  console.log(`\n4. 🔍 Esperando eventos de Webhook para clasificar escenario...`);
  await new Promise((resolve) => setTimeout(resolve, 3000));

  const trackingRecord = await getWhatsAppMessageStatus(wamid);

  console.log("----------------------------------------------------------------------");
  console.log("RESULTADO FINAL DEL DIAGNÓSTICO END-TO-END:");
  console.log("----------------------------------------------------------------------");
  if (trackingRecord) {
    console.log(`- WAMID: ${trackingRecord.wamid}`);
    console.log(`- Destinatario Anonimizado: ${maskPhoneNumber(trackingRecord.recipient_phone)}`);
    console.log(`- Estado Inicial: ${trackingRecord.initial_status}`);
    console.log(`- Estado Actual: ${trackingRecord.current_status}`);
    console.log(`- Timestamps:`);
    console.log(`  └─ Creado (dispatch_requested): ${trackingRecord.created_at}`);
    console.log(`  └─ Enviado (sent): ${trackingRecord.sent_at || "Pendiente/Ausente"}`);
    console.log(`  └─ Entregado (delivered): ${trackingRecord.delivered_at || "Pendiente/Ausente"}`);
    console.log(`  └─ Leído (read): ${trackingRecord.read_at || "Pendiente/Ausente"}`);
    console.log(`  └─ Fallido (failed): ${trackingRecord.failed_at || "N/A"}`);

    if (trackingRecord.current_status === "delivered" || trackingRecord.current_status === "read") {
      console.log("\n🎉 CASO A: Mensaje entregado correctamente en el dispositivo.");
    } else if (trackingRecord.current_status === "failed") {
      console.log(`\n❌ CASO B: Fallo posterior de Meta. Código de error: ${trackingRecord.error_code || "Desconocido"}`);
      console.log(`   Mensaje de Meta: ${trackingRecord.error_message || "N/A"}`);
      console.log(`   Detalles: ${trackingRecord.error_details || "N/A"}`);
    } else if (trackingRecord.current_status === "sent") {
      console.log("\n⚠️ CASO C: Mensaje enviado por Meta pero aún pendiente de confirmación 'delivered'.");
    } else {
      console.log("\nℹ️ CASO D: Solicitud 'dispatch_requested' registrada. Sin Webhook de estado recibido aún.");
    }
  } else {
    console.log("❌ No se encontró registro de seguimiento.");
  }
}

main().catch((err) => {
  console.error("❌ Error en script de diagnóstico:", err);
});
