import { config } from "dotenv";
import path from "path";
import { chromium } from "playwright";
import { parseMatchPdf } from "../src/lib/parser/parseMatchPdf";
import { getSeasonConfig } from "../src/lib/federation/config";
import { detectAvailableMatchdays } from "../src/lib/federation/detectMatchdays";
import { downloadJornadaHtml, downloadPdfToMemory } from "../src/lib/federation/scrapeMatchday";
import { PDFParse } from "pdf-parse";

config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const season = "2025/2026";
  const competition = "División de Honor - Grupo 5";
  
  const compConfig = getSeasonConfig(season, competition);
  if (!compConfig) {
    console.error("Configuración no encontrada");
    return;
  }
  
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
  await new Promise((r) => setTimeout(r, 2000));
  
  const session = { context, page };
  
  console.log("Descargando HTML de la Jornada 1...");
  const html = await downloadJornadaHtml(session, compConfig, 1);
  const actas = Array.from(new Set(Array.from(html.matchAll(/CodActa=(\d+)/gi)).map(m => m[1])));
  
  console.log(`Actas encontradas en J1: ${actas.join(", ")}`);
  
  if (actas.length > 0) {
    const testActa = actas[0];
    console.log(`Descargando PDF del acta ${testActa}...`);
    try {
      const pdfUrl = `https://${domain}/pnfg/NPcd/NFG_CmpPartido?cod_primaria=1000120&CodActa=${testActa}&cod_acta=${testActa}&NPcd_Pdf=1`;
      const buffer = await downloadPdfToMemory(session, testActa, targetJornadaUrl, compConfig);
      console.log(`PDF descargado con éxito (${buffer.length} bytes).`);
      
      console.log("Intentando parsear el PDF...");
      const result = await parseMatchPdf(buffer);
      
      // Obtener el texto extraído del PDF
      const parser = new PDFParse({ data: buffer });
      const pdfData = await parser.getText();
      await parser.destroy();
      const text = pdfData.text;
      
      console.log("\n--- PRIMERAS 1500 LETRAS DEL TEXTO DEL PDF ---");
      console.log(text.substring(0, 1500));
      console.log("----------------------------------------------\n");
      
      const scoreMatches = Array.from(text.matchAll(/\(\s*(\d+)\s*\)/g));
      console.log("Coincidencias de marcadores parentizados:", scoreMatches.map((m: any) => m[0]));

      console.log("¡Éxito al parsear! Datos obtenidos:");
      console.log("Equipos:", result.local_team, "vs", result.visitor_team);
      console.log("Resultado:", result.goals_local, "-", result.goals_visitor);
      console.log("Fecha:", result.date, "| Campo:", result.campo);
      console.log("Alineación Local (primeros 3):", result.local_players.slice(0, 3).map(p => `${p.number} - ${p.name}`));
      console.log("Goles:", result.goals);
      console.log("Tarjetas:", result.cards);
    } catch (err: any) {
      console.error("ERROR AL PARSEAR EL ACTA:", err.message || err);
      if (err.stack) console.error(err.stack);
    }
  } else {
    console.log("No se encontraron actas.");
  }
  
  await browser.close();
}

main().catch(console.error);
