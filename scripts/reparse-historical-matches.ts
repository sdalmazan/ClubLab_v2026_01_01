// ============================================================
// reparse-historical-matches.ts — Script de Reprocesamiento
// ============================================================
// Recorre los partidos de la base de datos, descarga las actas PDF y
// extrae el cuerpo técnico y los motivos de las tarjetas utilizando el
// parser mejorado, guardando la info en Main_DB de forma segura.
//
// Uso:
//   npx tsx scripts/reparse-historical-matches.ts
//   npx tsx scripts/reparse-historical-matches.ts --limit=5
//   npx tsx scripts/reparse-historical-matches.ts --season=2025/2026
// ============================================================

import { config } from "dotenv";
import path from "path";
config({ path: path.resolve(process.cwd(), ".env.local") });

function getArgValue(name: string): string | null {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!arg) return null;
  return arg.split("=").slice(1).join("=");
}

async function main() {
  console.log("════════════════════════════════════════════════════════");
  console.log("  Reprocesamiento de Actas Históricas (Cuerpo Técnico)");
  console.log("════════════════════════════════════════════════════════");

  // Importaciones dinámicas
  const { createAdminClient } = await import("../src/lib/supabase/admin");
  const { statsAdmin } = await import("../src/lib/supabase/stats-admin");
  const { createRfcylfHttpSession, downloadPdfToMemory } = await import("../src/lib/federation/rfcylf-http");
  const { parseMatchPdf } = await import("../src/lib/parser/parseMatchPdf");

  // 1. Inicializar clientes Supabase
  let mainSupabase;
  try {
    mainSupabase = createAdminClient();
  } catch (err) {
    console.error("ERROR: No se pudo iniciar el cliente Supabase principal:", err);
    process.exit(1);
  }

  // 2. Cargar organizaciones
  console.log("  Cargando organizaciones desde Main_DB...");
  const { data: orgs, error: orgsErr } = await mainSupabase
    .from("organizations")
    .select("id, settings");

  if (orgsErr || !orgs || orgs.length === 0) {
    console.error("ERROR: No se encontraron organizaciones en la base de datos principal.", orgsErr);
    process.exit(1);
  }
  console.log(`  Se cargaron ${orgs.length} organizaciones.`);

  // 3. Cargar partidos de Statistics_DB
  const limitVal = getArgValue("limit");
  const limit = limitVal ? parseInt(limitVal) : null;
  const season = getArgValue("season");

  console.log("  Cargando partidos de la base de datos de estadísticas...");
  let query = statsAdmin
    .from("stat_matches")
    .select("id, federation_id, home_team, away_team, season, matchday");
  
  if (season) {
    query = query.eq("season", season);
  }
  
  // Ordenar para consistencia
  const { data: matches, error: matchesErr } = await query
    .order("season", { ascending: false })
    .order("matchday", { ascending: true });

  if (matchesErr || !matches) {
    console.error("ERROR: No se pudieron cargar los partidos de la base de datos de estadísticas:", matchesErr);
    process.exit(1);
  }

  console.log(`  Se encontraron ${matches.length} partidos en total.`);

  // 4. Filtrar partidos que requieren reprocesamiento
  const primaryOrg = orgs[0];
  const primaryScoutingMatches = primaryOrg.settings?.scouting?.matches || {};

  const matchesToProcess = matches.filter((m) => {
    if (!m.federation_id) return false;
    
    const savedMatchNode = primaryScoutingMatches[m.id];
    // Re-procesamos si no tiene local_staff (o si queremos forzar el reprocesamiento)
    const hasStaff = savedMatchNode?.local_staff !== undefined && savedMatchNode?.local_staff !== null;
    return !hasStaff;
  });

  console.log(`  Partidos que requieren descarga y parsing de PDF: ${matchesToProcess.length}`);

  const finalMatchesToProcess = limit ? matchesToProcess.slice(0, limit) : matchesToProcess;
  if (finalMatchesToProcess.length > 0) {
    console.log(`  Procesando una muestra de ${finalMatchesToProcess.length} partidos.`);
  } else {
    console.log("  ¡Todos los partidos ya tienen información registrada en la caché!");
    process.exit(0);
  }

  // 5. Iniciar sesión en rfcylf.es
  let session;
  try {
    session = await createRfcylfHttpSession();
  } catch (err: any) {
    console.error("ERROR: No se pudo conectar a la federación:", err.message);
    process.exit(1);
  }

  const delayMs = Number(getArgValue("delay")) || 1500;
  let successCount = 0;
  let failCount = 0;

  for (let idx = 0; idx < finalMatchesToProcess.length; idx++) {
    const match = finalMatchesToProcess[idx];
    console.log(`\n  [${idx + 1}/${finalMatchesToProcess.length}] Procesando partido ID: ${match.id} (Acta ${match.federation_id})`);
    console.log(`  ${match.home_team} vs ${match.away_team} | Temporada ${match.season} J${match.matchday}`);

    try {
      // Descargar PDF
      const { buffer, session: updatedSession } = await downloadPdfToMemory(
        session,
        match.federation_id,
        "https://www.rfcylf.es/"
      );
      session = updatedSession;

      // Parsear PDF
      const parsedReport = await parseMatchPdf(buffer);
      console.log(`  - Local Staff: Coach=${parsedReport.local_staff?.coach || "N/A"}`);
      console.log(`  - Visitor Staff: Coach=${parsedReport.visitor_staff?.coach || "N/A"}`);
      
      // Imprimir goles especiales si se detectan
      for (const goal of parsedReport.goals) {
        if (goal.type === "own_goal") {
          console.log(`  - GOL DETECTADO: ¡Autogol! de ${goal.player_name} (${goal.team}) en Min ${goal.minute}'`);
        } else if (goal.type === "penalty") {
          console.log(`  - GOL DETECTADO: Gol de Penalti de ${goal.player_name} (${goal.team}) en Min ${goal.minute}'`);
        }
      }

      // Imprimir tarjetas disciplinarias especiales si se detectan
      for (const card of parsedReport.cards) {
        if (card.reason_type === "protesta") {
          console.log(`  - TARJETA DETECTADA: Protesta de ${card.player_name} (${card.team}) en Min ${card.minute}'`);
        } else if (card.reason_type === "violencia") {
          console.log(`  - TARJETA DETECTADA: Conducta violenta de ${card.player_name} (${card.team}) en Min ${card.minute}'`);
        }
      }

      // 6. Actualizar cada organización en Main_DB con el nodo de scouting del partido
      for (const org of orgs) {
        const orgSettings = org.settings || {};
        const currentScouting = orgSettings.scouting || { matches: {} };
        const matchNode = currentScouting.matches?.[match.id] || { overrides: {}, local_staff: null, visitor_staff: null };

        // Guardar staff técnico (ya no incluye delegate)
        matchNode.local_staff = parsedReport.local_staff;
        matchNode.visitor_staff = parsedReport.visitor_staff;

        // Auto-poblar clasificaciones de tarjetas
        if (!matchNode.overrides) matchNode.overrides = {};
        if (!matchNode.overrides.card_classifications) {
          matchNode.overrides.card_classifications = {};
        }

        for (const card of parsedReport.cards) {
          if (card.reason_type && card.reason_type !== "lance") {
            const cardKey = `${card.player_name}-${card.minute}`;
            if (!matchNode.overrides.card_classifications[cardKey]) {
              matchNode.overrides.card_classifications[cardKey] = card.reason_type;
            }
          }
        }

        const newSettings = {
          ...orgSettings,
          scouting: {
            ...currentScouting,
            matches: {
              ...(currentScouting.matches || {}),
              [match.id]: matchNode,
            },
          },
        };

        // Guardar en Supabase principal
        const { error: updateErr } = await mainSupabase
          .from("organizations")
          .update({ settings: newSettings })
          .eq("id", org.id);

        if (updateErr) {
          console.error(`  - ERROR al guardar settings para organización ${org.id}:`, updateErr.message);
        } else {
          org.settings = newSettings;
        }
      }

      successCount++;
    } catch (err: any) {
      failCount++;
      console.error(`  - ERROR al procesar acta del partido:`, err.message);
    }

    if (idx < finalMatchesToProcess.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  console.log("\n════════════════════════════════════════════════════════");
  console.log("  RESUMEN DE EJECUCIÓN DEL REPARSEADO");
  console.log("════════════════════════════════════════════════════════");
  console.log(`  Procesados con éxito:  ${successCount}`);
  console.log(`  Fallidos:             ${failCount}`);
  console.log("════════════════════════════════════════════════════════\n");

  process.exit(successCount > 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
