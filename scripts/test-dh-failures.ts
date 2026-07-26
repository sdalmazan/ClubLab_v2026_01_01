import { config } from "dotenv";
import path from "path";
import { chromium } from "playwright";
import { parseMatchPdf } from "../src/lib/parser/parseMatchPdf";
import { getSeasonConfig } from "../src/lib/federation/config";
import { downloadJornadaHtml, downloadPdfToMemory } from "../src/lib/federation/scrapeMatchday";

config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const season = "2025/2026";
  const competition = "División de Honor - Grupo 5";
  
  const compConfig = getSeasonConfig(season, competition);
  if (!compConfig) return;
  
  const domain = compConfig.domain || "marcadores.rfef.es";
  const targetJornadaUrl = `https://${domain}/pnfg/NPcd/NFG_CmpJornada?cod_primaria=1000120&CodCompeticion=${compConfig.competicion}&CodGrupo=${compConfig.grupo}&CodTemporada=${compConfig.temporada}&CodJornada=1&cod_agrupacion=${compConfig.codAgrupacion}`;

  console.log("Iniciando navegador...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: "es-ES" });
  
  await context.addCookies([{
    name: "cookie_aceptada",
    value: "1",
    domain: domain,
    path: "/",
    secure: true,
  }]);
  
  const page = await context.newPage();
  await page.goto(`https://${domain}/`, { waitUntil: "domcontentloaded" }).catch(() => null);
  await new Promise((r) => setTimeout(r, 1000));
  
  const session = { context, page };
  
  // Rastrear jornadas 1 a 5 para encontrar fallos
  for (let j = 1; j <= 8; j++) {
    console.log(`\n--- Analizando Jornada ${j} ---`);
    try {
      const html = await downloadJornadaHtml(session, compConfig, j);
      const actas = Array.from(new Set(Array.from(html.matchAll(/CodActa=(\d+)/gi)).map(m => m[1])));
      
      for (const acta of actas) {
        try {
          const buffer = await downloadPdfToMemory(session, acta, targetJornadaUrl, compConfig);
          await parseMatchPdf(buffer);
        } catch (err: any) {
          console.log(`[FALLO] Acta ${acta} en Jornada ${j}: ${err.message}`);
          // Si queremos ver el stack trace completo del error:
          console.error(err.stack);
        }
      }
    } catch (jErr: any) {
      console.log(`Error cargando jornada ${j}:`, jErr.message);
    }
  }
  
  await browser.close();
}

main().catch(console.error);
