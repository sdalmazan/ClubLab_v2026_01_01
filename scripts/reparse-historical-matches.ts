// ============================================================
// reparse-historical-matches.ts — Script de Reprocesamiento (Playwright Headless)
// ============================================================
// Recorre los partidos de la base de datos, descarga las actas PDF en
// segundo plano usando Playwright, y extrae el cuerpo técnico y los
// motivos de las tarjetas utilizando el parser mejorado.
//
// Uso:
//   npx tsx scripts/reparse-historical-matches.ts
//   npx tsx scripts/reparse-historical-matches.ts --limit=5
//   npx tsx scripts/reparse-historical-matches.ts --season=2025/2026 --force
// ============================================================

import { config } from "dotenv";
import path from "path";
import { chromium } from "playwright";
config({ path: path.resolve(process.cwd(), ".env.local") });

function getArgValue(name: string): string | null {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!arg) return null;
  return arg.split("=").slice(1).join("=");
}

function hasArg(name: string): boolean {
  return process.argv.some((a) => a === `--${name}` || a.startsWith(`--${name}=`));
}

async function main() {
  console.log("════════════════════════════════════════════════════════");
  console.log("  Reprocesamiento de Actas Históricas (Playwright Headless)");
  console.log("════════════════════════════════════════════════════════");

  // Importaciones dinámicas
  const { createAdminClient } = await import("../src/lib/supabase/admin");
  const { statsAdmin } = await import("../src/lib/supabase/stats-admin");
  const { getSeasonConfig } = await import("../src/lib/federation/config");
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
  const force = hasArg("force");

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
    if (force) return true;
    
    const savedMatchNode = primaryScoutingMatches[m.id];
    // Re-procesamos si no tiene local_staff o si tiene valores nulos
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

  // 5. Iniciar navegador Playwright en segundo plano (Headless)
  console.log("  Iniciando navegador Chromium en segundo plano (invisible)...");
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

  const delayMs = Number(getArgValue("delay")) || 1500;
  let successCount = 0;
  let failCount = 0;

  const loadedMatchdays = new Set<string>();

  for (let idx = 0; idx < finalMatchesToProcess.length; idx++) {
    const match = finalMatchesToProcess[idx];
    console.log(`\n  [${idx + 1}/${finalMatchesToProcess.length}] Procesando partido ID: ${match.id} (Acta ${match.federation_id})`);
    console.log(`  ${match.home_team} vs ${match.away_team} | Temporada ${match.season} J${match.matchday}`);

    try {
      const seasonConfig = getSeasonConfig(match.season);
      let refererUrl = "https://www.rfcylf.es/";

      if (seasonConfig) {
        refererUrl = `https://www.rfcylf.es/pnfg/NPcd/NFG_CmpJornada?cod_primaria=1000120&CodCompeticion=${seasonConfig.competicion}&CodGrupo=${seasonConfig.grupo}&CodTemporada=${seasonConfig.temporada}&CodJornada=${match.matchday}`;
        
        // Calentar la sesión navegando a la jornada en el navegador (una vez por jornada)
        const matchdayKey = `${match.season}-${match.matchday}`;
        if (!loadedMatchdays.has(matchdayKey)) {
          console.log(`  - Calentando sesión en segundo plano para Jornada ${match.matchday}...`);
          await page.goto(refererUrl, { waitUntil: "domcontentloaded" }).catch(() => null);
          loadedMatchdays.add(matchdayKey);
          await new Promise((r) => setTimeout(r, 2000));
        }
      }

      // Descargar PDF usando el contexto de red del navegador (hereda cookies de sesión e IP)
      console.log(`  - Descargando acta PDF...`);
      const pdfUrl = `https://www.rfcylf.es/pnfg/NPcd/NFG_CmpPartido?cod_primaria=1000120&CodActa=${match.federation_id}&cod_acta=${match.federation_id}&NPcd_Pdf=1`;
      
      let response = await context.request.get(pdfUrl, {
        headers: {
          Referer: refererUrl,
          Accept: "application/pdf,text/html;q=0.9,*/*;q=0.8",
        },
      });

      let buffer = await response.body();

      // Si por alguna razón devuelve 0 bytes, aplicamos reintento con cooling down de IP
      if (buffer.length === 0) {
        console.log("  [Alerta] Descarga vacía. Enfriando sesión 15s y reintentando...");
        await new Promise((r) => setTimeout(r, 15000));
        // Recargar página de jornada
        if (seasonConfig) {
          await page.goto(refererUrl, { waitUntil: "domcontentloaded" }).catch(() => null);
          await new Promise((r) => setTimeout(r, 2000));
        }
        response = await context.request.get(pdfUrl, {
          headers: { Referer: refererUrl, Accept: "application/pdf" },
        });
        buffer = await response.body();
      }

      if (buffer.length < 1000) {
        throw new Error(`El acta descargada no es un PDF válido (bytes=${buffer.length})`);
      }

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
      const randomExtra = Math.random() * 3000;
      const finalDelay = delayMs + randomExtra;
      console.log(`  - Pausa de seguridad de ${(finalDelay / 1000).toFixed(1)}s antes del próximo partido...`);
      await new Promise((resolve) => setTimeout(resolve, finalDelay));
    }
  }

  // Cerrar navegador
  await browser.close();

  // ════════════════════════════════════════════════════════
  // 6. POST-PROCESO: Recuperar entrenadores ausentes ("No presenta")
  // ════════════════════════════════════════════════════════
  console.log("\n  Iniciando Post-Proceso de recuperación de entrenadores ausentes...");
  const { data: latestOrgs } = await mainSupabase
    .from("organizations")
    .select("id, settings");

  if (latestOrgs) {
    for (const org of latestOrgs) {
      const orgSettings = org.settings || {};
      const scouting = orgSettings.scouting || { matches: {} };
      const scoutingMatches = { ...(scouting.matches || {}) };

      let postProcessCount = 0;

      // Obtener todos los equipos únicos de los partidos cargados
      const teams = new Set<string>();
      for (const m of matches) {
        teams.add(m.home_team);
        teams.add(m.away_team);
      }

      for (const team of teams) {
        // Encontrar cronológicamente todos los partidos del equipo en la temporada seleccionada
        const teamMatches = matches
          .filter(m => m.home_team === team || m.away_team === team)
          .sort((a, b) => a.matchday - b.matchday);

        for (let i = 0; i < teamMatches.length; i++) {
          const match = teamMatches[i];
          const matchNode = scoutingMatches[match.id] || {};
          const isHome = match.home_team === team;
          const currentStaff = isHome ? matchNode.local_staff : matchNode.visitor_staff;
          const coachName = currentStaff?.coach;

          const isAbsent = !coachName || coachName === "N/A" || coachName.trim() === "" || coachName.toLowerCase().includes("no presenta");

          if (isAbsent) {
            let foundStaff: any = null;
            let foundMatchday = -1;

            // 1. Buscar hacia atrás (partidos anteriores)
            for (let j = i - 1; j >= 0; j--) {
              const prevMatch = teamMatches[j];
              const prevNode = scoutingMatches[prevMatch.id];
              if (prevNode) {
                const prevIsHome = prevMatch.home_team === team;
                const prevStaff = prevIsHome ? prevNode.local_staff : prevNode.visitor_staff;
                if (prevStaff?.coach && !prevStaff.coach.toLowerCase().includes("no presenta") && prevStaff.coach !== "N/A") {
                  foundStaff = prevStaff;
                  foundMatchday = prevMatch.matchday;
                  break;
                }
              }
            }

            // 2. Buscar hacia adelante (partidos posteriores)
            if (!foundStaff) {
              for (let j = i + 1; j < teamMatches.length; j++) {
                const nextMatch = teamMatches[j];
                const nextNode = scoutingMatches[nextMatch.id];
                if (nextNode) {
                  const nextIsHome = nextMatch.home_team === team;
                  const nextStaff = nextIsHome ? nextNode.local_staff : nextNode.visitor_staff;
                  if (nextStaff?.coach && !nextStaff.coach.toLowerCase().includes("no presenta") && nextStaff.coach !== "N/A") {
                    foundStaff = nextStaff;
                    foundMatchday = nextMatch.matchday;
                    break;
                  }
                }
              }
            }

            if (foundStaff) {
              if (!scoutingMatches[match.id]) {
                scoutingMatches[match.id] = { overrides: {}, local_staff: null, visitor_staff: null };
              }
              const nodeToUpdate = { ...scoutingMatches[match.id] };
              
              if (isHome) {
                nodeToUpdate.local_staff = {
                  coach: foundStaff.coach,
                  assistant: foundStaff.assistant || null,
                  physio: foundStaff.physio || null,
                  fitness_coach: foundStaff.fitness_coach || null,
                };
              } else {
                nodeToUpdate.visitor_staff = {
                  coach: foundStaff.coach,
                  assistant: foundStaff.assistant || null,
                  physio: foundStaff.physio || null,
                  fitness_coach: foundStaff.fitness_coach || null,
                };
              }
              scoutingMatches[match.id] = nodeToUpdate;
              postProcessCount++;
              console.log(`  [Post-Process] Rellenando entrenador ausente de "${team}" en Jornada ${match.matchday} con el de la Jornada ${foundMatchday} (${foundStaff.coach})`);
            }
          }
        }
      }

      if (postProcessCount > 0) {
        const updatedSettings = {
          ...orgSettings,
          scouting: {
            ...scouting,
            matches: scoutingMatches,
          },
        };

        const { error: postErr } = await mainSupabase
          .from("organizations")
          .update({ settings: updatedSettings })
          .eq("id", org.id);

        if (postErr) {
          console.error(`  - ERROR al guardar post-proceso para organización ${org.id}:`, postErr.message);
        } else {
          console.log(`  - Post-proceso completado con éxito para organización ${org.id}: ${postProcessCount} entrenadores corregidos.`);
        }
      } else {
        console.log(`  - No se requirieron correcciones de post-proceso para la organización ${org.id}.`);
      }
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
