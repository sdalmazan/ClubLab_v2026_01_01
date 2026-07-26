import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const url = "https://www.rfcylf.es/pnfg/NPcd/NFG_CmpJornada?cod_primaria=1000120&CodCompeticion=24218932&CodGrupo=24218933&CodTemporada=22&cod_agrupacion=&CodJornada=1&Sch_Codigo_Delegacion=&Sch_Tipo_Juego=";

  console.log("Navigating to exact URL...");
  await page.goto(url, { waitUntil: "domcontentloaded" });
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
