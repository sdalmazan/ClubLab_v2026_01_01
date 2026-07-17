import path from "path";
import readline from "readline";
import { chromium, type BrowserContext, type Page } from "playwright";

// ============================================================
// rfcylf-browser.ts
// Gestión de la sesión de Playwright para rfcylf.es
// Usa perfil persistente en scripts/.rfcylf-browser-profile/
//
// IMPORTANTE: createRfcylfSession recibe la URL de la jornada 1
// de la competición que se va a scrapear, de modo que siempre
// navega a la temporada/competición correcta antes de validar.
// ============================================================

export type RfcylfSession = {
  context: BrowserContext;
  page: Page;
};

const HOME_URL = "https://www.rfcylf.es/";

// Perfil del navegador con sesión persistente (cookies, localStorage, etc.)
const PROFILE_PATH = path.resolve(
  process.cwd(),
  "scripts",
  ".rfcylf-browser-profile"
);

function waitForEnter(message: string): Promise<void> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(message, () => {
      rl.close();
      resolve();
    });
  });
}

async function pageContainsMatches(page: Page): Promise<boolean> {
  const html = await page.content().catch(() => "");
  return html.includes("CodActa=") || html.includes("NFG_CmpPartido");
}

async function logPage(page: Page, label: string): Promise<void> {
  const html = await page.content().catch(() => "");
  const text = await page.locator("body").innerText().catch(() => "");
  console.log(
    `${label}: url=${page.url()}, html=${html.length}b, texto=${text.length}b`
  );
}

/**
 * Guía al usuario para establecer manualmente la sesión en rfcylf.es.
 * Navega directamente a la jornada 1 de la competición/temporada objetivo.
 */
async function prepareSessionManually(
  page: Page,
  targetUrl: string
): Promise<void> {
  console.log("");
  console.log("══════════════════════════════════════════");
  console.log(" INICIALIZACIÓN MANUAL DE RFCYLF          ");
  console.log("══════════════════════════════════════════");
  console.log("");
  console.log("Se abre Chrome con la página de la competición.");
  console.log("Comprueba que se ven los partidos y pulsa ENTER aquí.");
  console.log("");
  console.log(`Abriendo: ${targetUrl}`);
  console.log("");

  await page
    .goto(HOME_URL, { waitUntil: "domcontentloaded", timeout: 60_000 })
    .catch(() => null);

  await page.waitForTimeout(2_000);

  await page
    .goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 60_000 })
    .catch(() => null);

  await page.waitForTimeout(2_000);
  await logPage(page, "Página de jornada");

  while (true) {
    await waitForEnter(
      "\n¿Ves los partidos en Chrome? Pulsa ENTER para continuar..."
    );

    await page.waitForTimeout(1_000);
    await logPage(page, "Comprobación");

    const valid = await pageContainsMatches(page);
    if (valid) {
      console.log("✓ Sesión RFCYLF válida. Comenzando scraping.");
      break;
    }

    console.log("");
    console.log("✗ No se detectan partidos todavía.");
    console.log(
      "  Asegúrate de estar en la página correcta y pulsa ENTER de nuevo."
    );
    console.log("");
  }

  const cookies = await page.context().cookies();
  console.log("Cookies guardadas:", cookies.map((c) => c.name).join(", "));
}

/**
 * Crea una sesión de Playwright con perfil persistente para rfcylf.es.
 *
 * Siempre navega a `targetJornadaUrl` (la jornada 1 de la competición
 * que se va a scrapear) antes de comprobar la sesión, así nunca se
 * confunde de temporada aunque el perfil tenga otra página guardada.
 *
 * @param targetJornadaUrl URL de la jornada 1 de la competición objetivo.
 */
export async function createRfcylfSession(
  targetJornadaUrl: string
): Promise<RfcylfSession> {
  const isHeadless =
    process.argv.includes("--headless") ||
    process.env.SCRAPER_HEADLESS === "true";

  const useChromiumOnly =
    process.argv.includes("--chromium-only") ||
    process.env.SCRAPER_CHROMIUM_ONLY === "true";

  console.log(
    `Abriendo navegador (headless=${isHeadless}, ` +
      `canal=${useChromiumOnly ? "chromium" : "chrome"}):`,
    PROFILE_PATH
  );

  const context = await chromium.launchPersistentContext(PROFILE_PATH, {
    channel: useChromiumOnly ? undefined : "chrome",
    headless: isHeadless,
    locale: "es-ES",
    viewport: { width: 1400, height: 900 },
    extraHTTPHeaders: {
      "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    },
  });

  const existingPages = context.pages();
  const page =
    existingPages.length > 0 ? existingPages[0] : await context.newPage();

  page.setDefaultNavigationTimeout(60_000);
  page.setDefaultTimeout(30_000);

  // Cookie de aceptación siempre presente
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

  // Navegar SIEMPRE a la URL objetivo de la temporada que se va a scrapear
  console.log(`Navegando a: ${targetJornadaUrl}`);
  await page
    .goto(targetJornadaUrl, { waitUntil: "domcontentloaded", timeout: 60_000 })
    .catch(() => null);
  await page.waitForTimeout(2_000);

  const alreadyValid = await pageContainsMatches(page);

  if (alreadyValid) {
    console.log("✓ Sesión válida (perfil persistente). Continuando.");
  } else {
    await prepareSessionManually(page, targetJornadaUrl);
  }

  return { context, page };
}

/**
 * Solicita validación manual cuando la sesión deja de responder durante el scraping.
 */
export async function resetRfcylfPage(session: RfcylfSession): Promise<void> {
  console.log("La sesión dejó de responder. Solicitando validación manual...");

  if (session.page.isClosed()) {
    session.page = await session.context.newPage();
  }

  await prepareSessionManually(session.page, session.page.url());
}

/**
 * Cierra la sesión del navegador.
 */
export async function closeRfcylfSession(
  session: RfcylfSession
): Promise<void> {
  await session.context.close();
}
