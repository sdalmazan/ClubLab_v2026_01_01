import { chromium } from "playwright";

async function main() {
  const url = "https://www.rfcylf.es/pnfg/NPcd/NFG_CmpJornada?cod_primaria=1000120&CodCompeticion=24218932&CodGrupo=24218933&CodTemporada=22&CodJornada=1";
  console.log("Navigating to:", url);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: "es-ES",
    extraHTTPHeaders: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  await context.addCookies([
    {
      name: "cookie_aceptada",
      value: "1",
      domain: "www.rfcylf.es",
      path: "/",
      secure: true,
      httpOnly: false,
      sameSite: "Lax",
    },
  ]);

  const page = await context.newPage();
  await page.goto("https://www.rfcylf.es/", { waitUntil: "domcontentloaded" }).catch(() => null);
  await new Promise((r) => setTimeout(r, 2000));

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await new Promise((r) => setTimeout(r, 2000));

  const html = await page.content();
  console.log("HTML length:", html.length);

  const tablesCount = await page.locator("table").count();
  console.log("Tables count:", tablesCount);

  for (let i = 0; i < tablesCount; i++) {
    const txt = await page.locator("table").nth(i).innerText();
    console.log(`\n=== TABLE ${i} ===\n${txt.substring(0, 500)}`);
  }

  await browser.close();
}

main().catch(console.error);
