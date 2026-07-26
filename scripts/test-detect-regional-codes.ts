import { config } from "dotenv";
import path from "path";
import { chromium } from "playwright";
config({ path: path.resolve(process.cwd(), ".env.local") });

async function checkUrl(page: any, url: string, name: string) {
  try {
    console.log(`[${name}] Navegando a: ${url}`);
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    console.log(`[${name}] Status: ${res ? res.status() : "No response"}`);
    
    // Esperar un breve instante para que cargue el JS
    await page.waitForTimeout(2000);
    
    const title = await page.title();
    console.log(`[${name}] Título de la página: ${title}`);
    
    // Buscar la cabecera de la competición en la página
    const heading = await page.locator("h1, h2, .titulo, .header").first().innerText().catch(() => "");
    console.log(`[${name}] Cabecera detectada: "${heading.trim()}"`);
    
    const bodyText = await page.locator("body").innerText();
    const hasJornada = bodyText.includes("Jornada") || bodyText.includes("JORNADA");
    const hasPartidos = bodyText.includes("Partido") || bodyText.includes("PARTIDO") || bodyText.includes("vs") || bodyText.includes("-");
    console.log(`[${name}] ¿Tiene 'Jornada'?: ${hasJornada ? "SÍ" : "NO"}`);
    console.log(`[${name}] ¿Tiene partidos?: ${hasPartidos ? "SÍ" : "NO"}`);
    
    // Imprimir una parte del texto que no sea el banner de cookies
    const containerText = await page.locator("#pnfg-contenedor, #contenido, .container, main").first().innerText().catch(() => "");
    if (containerText) {
      console.log(`[${name}] Texto del contenedor principal: "${containerText.substring(0, 300).trim().replace(/\s+/g, " ")}"`);
    } else {
      console.log(`[${name}] Texto del cuerpo (filtrado banner): "${bodyText.replace(/Consentimiento para cookies[\s\S]*?Aceptar/gi, "").substring(0, 300).trim().replace(/\s+/g, " ")}"`);
    }
  } catch (err: any) {
    console.error(`[${name}] Error:`, err.message);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: "es-ES",
  });
  
  await context.addCookies([
    {
      name: "cookie_aceptada",
      value: "1",
      domain: "www.rfcylf.es",
      path: "/",
      secure: true,
    }
  ]);
  
  const page = await context.newPage();
  
  // URL de prueba calentando en la home primero
  await page.goto("https://www.rfcylf.es/", { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 2000));

  const urlA = "https://www.rfcylf.es/pnfg/NPcd/NFG_CmpJornada?cod_primaria=1000120&CodCompeticion=11379753&CodGrupo=11379754&CodTemporada=20&CodJornada=1";
  
  await checkUrl(page, urlA, "Nacional Juvenil (Calculado)");
  
  await browser.close();
}

main().catch(console.error);
