import { chromium } from "playwright";

async function main() {
  console.log("Iniciando navegador Chromium en segundo plano (headless)...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  console.log("Navegando a google.com...");
  await page.goto("https://www.google.com");
  console.log("Título de la página:", await page.title());
  await browser.close();
  console.log("¡Playwright funciona correctamente en segundo plano!");
}

main().catch(console.error);
