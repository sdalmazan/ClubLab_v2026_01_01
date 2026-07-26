import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  console.log("Step 1: Visiting competition search page...");
  await page.goto("https://www.rfcylf.es/pnfg/NPcd/NFG_VisCompeticiones?cod_primaria=1000120", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  console.log("Step 2: Navigating to Jornada 1...");
  await page.goto("https://www.rfcylf.es/pnfg/NPcd/NFG_CmpJornada?cod_primaria=1000120&CodCompeticion=24218932&CodGrupo=24218933&CodTemporada=22&cod_agrupacion=&CodJornada=1&Sch_Codigo_Delegacion=&Sch_Tipo_Juego=", { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);

  const html = await page.content();
  console.log("HTML length:", html.length);

  const linksCount = await page.locator("a[href*='NFG_VisEquipo']").count();
  console.log("Team links count:", linksCount);
  if (linksCount > 0) {
    for (let i = 0; i < Math.min(6, linksCount); i++) {
      const text = await page.locator("a[href*='NFG_VisEquipo']").nth(i).textContent();
      console.log(`Link ${i}:`, text?.trim());
    }
  }

  await browser.close();
}

main().catch(console.error);
