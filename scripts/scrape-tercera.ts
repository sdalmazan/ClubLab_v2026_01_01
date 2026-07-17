// ============================================================
// scrape-tercera.ts — Scraper de Tercera Federación Grupo 8 (Playwright Headless)
// ============================================================
// Scrapea e inserta en la base de datos de estadísticas y actualiza la caché
// de scouting para la categoría "Tercera Federación - Grupo 8".
//
// Uso:
//   npx tsx scripts/scrape-tercera.ts [--season=2025/2026] [--delay=8000]
// ============================================================

import { config } from "dotenv";
import path from "path";
import { chromium } from "playwright";
config({ path: path.resolve(process.cwd(), ".env.local") });

function getArgValue(name: string): string | null {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.split("=")[1] : null;
}

async function main() {
  console.log("════════════════════════════════════════════════════════");
  console.log("  Scraper de Tercera Federación - Grupo 8 (Castilla y León)");
  console.log("════════════════════════════════════════════════════════");

  const { statsAdmin } = await import("../src/lib/supabase/stats-admin");
  const { runFederationScraperCore } = await import("../src/lib/federation/scraper");
  const { getSeasonConfig } = await import("../src/lib/federation/config");

  // Resolver temporadas a procesar
  const singleSeason = getArgValue("season");
  const seasonsToProcess = singleSeason ? [singleSeason] : ["2025/2026", "2024/2025"];
  
  // Resolver delay
  const delayVal = getArgValue("delay");
  const delayMatch = delayVal ? parseInt(delayVal) : 8000;

  const competitionName = "Tercera Federación - Grupo 8";

  const scraperOptions = {
    delayMatch: delayMatch,  // ms entre descargas de actas
    delayMatchday: 3000,     // ms entre jornadas
    maxMatchday: 34,         // 34 jornadas para 18 equipos
    emptyLimit: 4,           // Detenerse tras 4 jornadas vacías
  };

  for (let idx = 0; idx < seasonsToProcess.length; idx++) {
    const season = seasonsToProcess[idx];
    console.log(`\n[Temporada ${idx + 1}/${seasonsToProcess.length}] Iniciando ${competitionName} (${season})...`);

    const compConfig = getSeasonConfig(season, competitionName);
    if (!compConfig) {
      console.error(`ERROR: No se encontró la configuración para ${competitionName} en ${season}.`);
      continue;
    }

    const targetJornadaUrl = `https://www.rfcylf.es/pnfg/NPcd/NFG_CmpJornada?cod_primaria=1000120&CodCompeticion=${compConfig.competicion}&CodGrupo=${compConfig.grupo}&CodTemporada=${compConfig.temporada}&CodJornada=1`;

    console.log(`  - Iniciando navegador Chromium en segundo plano...`);
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      locale: "es-ES",
      extraHTTPHeaders: {
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, httpGecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    // Agregar cookie de aceptación de cookies para evitar banners
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
    page.setDefaultNavigationTimeout(45000);
    page.setDefaultTimeout(30000);

    // Calentar sesión en la home antes de ir a la jornada
    await page.goto("https://www.rfcylf.es/", { waitUntil: "domcontentloaded" }).catch(() => null);
    await new Promise((r) => setTimeout(r, 2000));

    const session = { context, page };

    try {
      console.log(`  - Lanzando núcleo del scraper...`);
      const summary = await runFederationScraperCore(
        compConfig,
        scraperOptions,
        { mode: "all" },
        statsAdmin,
        session
      );

      console.log(`\n✓ Temporada finalizada: ${competitionName} (${season})`);
      console.log(`  - Partidos encontrados: ${summary.matchesFound}`);
      console.log(`  - Partidos ya existentes: ${summary.matchesExisting}`);
      console.log(`  - Partidos insertados: ${summary.matchesInserted}`);
      console.log(`  - Partidos fallidos: ${summary.matchesFailed}`);
      console.log(`  - Detenido por: ${summary.stoppedBecause}`);
    } catch (err: any) {
      console.error(`  - ERROR crítico en scraper:`, err.message || err);
    } finally {
      await browser.close();
    }

    if (idx < seasonsToProcess.length - 1) {
      console.log("\n  - Pausa de seguridad de 10s antes de la siguiente temporada...");
      await new Promise((r) => setTimeout(r, 10000));
    }
  }

  console.log("\n════════════════════════════════════════════════════════");
  console.log("  PROCESO DE SCRAPING DE TERCERA FEDERACIÓN COMPLETO");
  console.log("════════════════════════════════════════════════════════\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
