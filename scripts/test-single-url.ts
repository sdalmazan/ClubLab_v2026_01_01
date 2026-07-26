import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  const url = "https://www.rfcylf.es/pnfg/NPcd/NFG_CmpJornada?cod_primaria=1000120&CodCompeticion=24218932&CodGrupo=24218933&CodTemporada=22&cod_agrupacion=&CodJornada=1&Sch_Codigo_Delegacion=&Sch_Tipo_Juego=";

  console.log("Navigating to:", url);
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);

  const html = await page.content();
  console.log("HTML length:", html.length);

  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("a"))
      .map(a => ({ text: a.textContent?.trim(), href: a.getAttribute("href") }))
      .filter(a => a.href && a.href.includes("NFG_VisEquipo"));
  });

  console.log("Team links count:", links.length);
  if (links.length > 0) {
    console.log("Sample links:", links.slice(0, 4));
  }

  await browser.close();
}

main().catch(console.error);
