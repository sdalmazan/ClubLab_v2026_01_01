import { config } from "dotenv";
config({ path: ".env.local" });

import { sendWhatsAppOTP, normalizePhoneNumber } from "../src/lib/whatsapp/service";

async function main() {
  const targetPhone = "685284495";
  console.log(`📱 Probando envío directo de WhatsApp a: ${targetPhone}...`);

  const { cleanPhone, digitsOnly } = normalizePhoneNumber(targetPhone);
  console.log(`- Teléfono limpio: ${cleanPhone} (Dígitos: ${digitsOnly})`);

  const result = await sendWhatsAppOTP({
    phoneNumber: targetPhone,
    code: "847291",
    recipientName: "Diego Ciria",
  });

  console.log("-------------------------------------------------");
  console.log("RESULTADO DE ENVÍO DE WHATSAPP:");
  console.log("-------------------------------------------------");
  console.log(JSON.stringify(result, null, 2));

  if (result.success) {
    console.log(`✅ ¡Mensaje enviado con éxito por Meta WhatsApp Cloud API! WAMID: ${result.wamid}`);
  } else {
    console.error("❌ Falló el envío de WhatsApp. Revisa las credenciales en .env.local.");
  }
}

main().catch((err) => console.error("Error en test de WhatsApp:", err));
