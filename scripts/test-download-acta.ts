import { config } from "dotenv";
import path from "path";
import fs from "fs";
config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const { statsAdmin } = await import("../src/lib/supabase/stats-admin");
  const { createRfcylfHttpSession, downloadPdfToMemory } = await import("../src/lib/federation/rfcylf-http");
  const { parseMatchPdf } = await import("../src/lib/parser/parseMatchPdf");

  console.log("Buscando partido...");
  const { data: match, error } = await statsAdmin
    .from("stat_matches")
    .select("id, federation_id, home_team, away_team, season, matchday")
    .eq("season", "2025/2026")
    .eq("matchday", 34)
    .ilike("home_team", "%Almazán%")
    .single();

  if (error || !match) {
    console.error("No se encontró el partido:", error);
    return;
  }

  console.log(`Partido encontrado: ID=${match.id}, Acta=${match.federation_id}, Teams=${match.home_team} vs ${match.away_team}`);

  console.log("Iniciando sesión...");
  const session = await createRfcylfHttpSession();

  console.log("Descargando PDF...");
  const { buffer } = await downloadPdfToMemory(session, match.federation_id, "https://www.rfcylf.es/");

  // Guardar en local
  const pdfPath = path.resolve(process.cwd(), "scripts", `acta_${match.federation_id}.pdf`);
  fs.writeFileSync(pdfPath, buffer);
  console.log(`PDF guardado en: ${pdfPath}`);

  console.log("Parseando PDF...");
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  const pdfData = await parser.getText();
  fs.writeFileSync(path.resolve(process.cwd(), "scripts", `acta_${match.federation_id}_text.txt`), pdfData.text);
  console.log("Raw text saved to scripts/acta_26086870_text.txt");

  const parsed = await parseMatchPdf(buffer);
  
  console.log("\nParsed Local Staff:", parsed.local_staff);
  console.log("Parsed Visitor Staff:", parsed.visitor_staff);
  
  console.log("\nParsed Goals:", JSON.stringify(parsed.goals, null, 2));
  console.log("\nParsed Cards:", JSON.stringify(parsed.cards, null, 2));

  console.log("\nBuscando eventos registrados en la BD...");
  const { data: dbEvents } = await statsAdmin
    .from("stat_events")
    .select("*")
    .eq("match_id", match.id)
    .in("event_type", ["goal", "yellow_card", "red_card"]);
  console.log("Eventos de la BD (Goles y Tarjetas):", JSON.stringify(dbEvents, null, 2));
}

main().catch(console.error);
