// ============================================================
// scrape-nacional-juvenil.ts — Scraper de Liga Nacional Juvenil (Playwright Headless)
// ============================================================
// Scrapea e inserta en la base de datos de estadísticas y actualiza la caché
// de scouting para la categoría "Liga Nacional Juvenil" en las temporadas
// 2025/2026 y 2024/2025.
//
// Uso:
//   npx tsx scripts/scrape-nacional-juvenil.ts
// ============================================================

import { config } from "dotenv";
import path from "path";
import { chromium } from "playwright";
config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  console.log("════════════════════════════════════════════════════════");
  console.log("  Scraper de Liga Nacional Juvenil (Castilla y León)");
  console.log("  Temporadas 2025/2026 y 2024/2025");
  console.log("════════════════════════════════════════════════════════");

  const { statsAdmin } = await import("../src/lib/supabase/stats-admin");
  const { runFederationScraperCore } = await import("../src/lib/federation/scraper");
  const { getSeasonConfig } = await import("../src/lib/federation/config");

  // Definir las 2 temporadas a scrapear
  const targets = [
    { season: "2025/2026", competition: "Liga Nacional Juvenil" },
    { season: "2024/2025", competition: "Liga Nacional Juvenil" },
  ];

  const scraperOptions = {
    delayMatch: 8000,       // 8 segundos de pausa entre descargas de actas
    delayMatchday: 3000,    // 3 segundos de pausa entre jornadas
    maxMatchday: 34,        // 34 jornadas en liga de 18 equipos
    emptyLimit: 4,          // Detenerse tras 4 jornadas vacías consecutivas
  };

  for (let idx = 0; idx < targets.length; idx++) {
    const target = targets[idx];
    console.log(`\n[Temporada ${idx + 1}/${targets.length}] Iniciando ${target.competition} (${target.season})...`);

    const compConfig = getSeasonConfig(target.season, target.competition);
    if (!compConfig) {
      console.error(`ERROR: No se encontró la configuración para ${target.competition} en ${target.season}.`);
      continue;
    }

    const domain = compConfig.domain || "www.rfcylf.es";
    const targetJornadaUrl = `https://${domain}/pnfg/NPcd/NFG_CmpJornada?cod_primaria=1000120&CodCompeticion=${compConfig.competicion}&CodGrupo=${compConfig.grupo}&CodTemporada=${compConfig.temporada}&CodJornada=1`;

    console.log(`  - Iniciando navegador Chromium en segundo plano...`);
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      locale: "es-ES",
      extraHTTPHeaders: {
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    // Agregar cookie de aceptación de cookies para evitar banners
    await context.addCookies([
      {
        name: "cookie_aceptada",
        value: "1",
        domain: domain,
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
    await page.goto(`https://${domain}/`, { waitUntil: "domcontentloaded" }).catch(() => null);
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

      console.log(`\n✓ Temporada finalizada: ${target.competition} (${target.season})`);
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

    if (idx < targets.length - 1) {
      console.log("\n  - Pausa de seguridad de 10s antes del siguiente grupo...");
      await new Promise((r) => setTimeout(r, 10000));
    }
  }

  console.log("\n════════════════════════════════════════════════════════");
  console.log("  PROCESO DE SCRAPING DE LIGA NACIONAL JUVENIL COMPLETADO");
  console.log("════════════════════════════════════════════════════════\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
