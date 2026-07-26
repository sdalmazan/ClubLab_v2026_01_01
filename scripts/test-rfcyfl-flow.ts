import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  console.log("Going to main page...");
  await page.goto("https://www.rfcylf.es/pnfg/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  console.log("Going to jornada 1 with referer...");
  const response = await page.goto(
    "https://www.rfcylf.es/pnfg/NPcd/NFG_CmpJornada?cod_primaria=1000120&CodCompeticion=24218932&CodGrupo=24218933&CodTemporada=22&CodJornada=1",
    { waitUntil: "domcontentloaded" }
  );

  console.log("Status:", response?.status());
  const html = await page.content();
  console.log("HTML length:", html.length);
  console.log("Snippet:", html.substring(0, 300));

  await browser.close();
}

main().catch(console.error);
