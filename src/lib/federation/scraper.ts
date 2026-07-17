import type { SupabaseClient } from "@supabase/supabase-js";
import { parseMatchPdf } from "../parser/parseMatchPdf";
import {
  createRfcylfSession,
  closeRfcylfSession,
  type RfcylfSession,
} from "./rfcylf-browser";
import type {
  CompetitionConfig,
  ScraperOptions,
  ScraperSummary,
  MatchdayPageResult,
} from "./types";
import { detectAvailableMatchdays } from "./detectMatchdays";
import { downloadJornadaHtml, downloadPdfToMemory, getJornadaUrl } from "./scrapeMatchday";
import { saveMatchTransactional } from "./saveMatch";

// ============================================================
// Orquestador principal del scraper RFCYLF con Playwright
// ============================================================

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Pausa con jitter aleatorio (±40%) para evitar patrones de tráfico
 * periódico que los firewalls detectan como bot.
 */
function sleepJitter(ms: number): Promise<void> {
  const jitter = ms * 0.4;
  const actual = ms - jitter + Math.random() * jitter * 2;
  return sleep(Math.round(actual));
}

function classifyMatchdayResult(html: string, matchday: number): MatchdayPageResult {
  if (!html || html.length < 1000) {
    return { status: "blocked", matchday, reason: "El contenido HTML está vacío o es demasiado corto" };
  }
  if (
    html.includes("NLogin") ||
    html.includes("NSess=1") ||
    (!html.includes("cookie_aceptada") && html.includes("Inicie sesión")) ||
    html.includes("Acceso denegado") ||
    html.includes("Mantenimiento")
  ) {
    return { status: "blocked", matchday, reason: "Redirección a login o sesión bloqueada" };
  }

  const actaMatches = Array.from(html.matchAll(/CodActa=(\d+)/gi));
  const uniqueActas = Array.from(new Set(actaMatches.map((m) => m[1])));

  if (uniqueActas.length > 0) {
    return { status: "valid", matchday, html, actaIds: uniqueActas };
  }

  const isNormalPage =
    html.includes("Real Federación de Castilla y León") ||
    html.includes("NPcd/NFG_CmpJornada") ||
    (html.includes("Jornada") && html.includes("Competición"));

  if (isNormalPage) {
    return { status: "not_found", matchday, reason: "Jornada vacía o sin partidos oficiales en la federación" };
  }

  return { status: "error", matchday, reason: "Estructura de la página no reconocida o incompleta" };
}

/**
 * Núcleo del scraper. Acepta una sesión de Playwright ya abierta para
 * permitir reutilizarla entre múltiples temporadas sin reabrir el navegador.
 *
 * @see runFederationScraper — versión con gestión automática de sesión (una temporada)
 */
export async function runFederationScraperCore(
  config: CompetitionConfig,
  options: ScraperOptions,
  modeConfig: {
    mode: "single" | "range" | "all";
    jornada?: number;
    desde?: number;
    hasta?: number;
  },
  supabase: SupabaseClient,
  session: RfcylfSession
): Promise<ScraperSummary> {
  const summary: ScraperSummary = {
    success: true,
    season: config.season,
    competitionName: config.competitionName,
    competitionCode: config.competicion,
    groupCode: config.grupo,
    seasonCode: config.temporada,
    detectionMethod: "manual",
    detectedMatchdays: [],
    processedMatchdays: [],
    validMatchdays: [],
    emptyMatchdays: [],
    matchesFound: 0,
    matchesExisting: 0,
    matchesInserted: 0,
    matchesFailed: 0,
    stoppedBecause: "completed",
    errors: [],
  };

  console.log(`Iniciando scraper para la temporada ${config.season}...`);

  // 1. Partidos ya importados
  const { data: existingMatches, error: existingMatchesError } = await supabase
    .from("stat_matches")
    .select("federation_id")
    .eq("season", config.season)
    .eq("competition", config.competitionName);

  if (existingMatchesError) {
    throw new Error(`No se pudieron consultar los partidos existentes: ${existingMatchesError.message}`);
  }

  const scrapedIds = new Set((existingMatches ?? []).map((m: any) => String(m.federation_id)));
  summary.matchesExisting = scrapedIds.size;
  console.log(`Detectados ${scrapedIds.size} partidos ya importados en la base de datos.`);

  let targetMatchdays: number[] = [];

  if (modeConfig.mode === "single") {
    const j = modeConfig.jornada!;
    targetMatchdays = [j];
    summary.detectionMethod = "manual";
    console.log(`Modo jornada única: Jornada ${j}`);
  } else if (modeConfig.mode === "range") {
    const from = modeConfig.desde!;
    const to = modeConfig.hasta!;
    targetMatchdays = Array.from({ length: to - from + 1 }, (_, i) => from + i);
    summary.detectionMethod = "manual";
    console.log(`Modo rango manual: Jornadas ${from} a ${to}`);
  } else if (modeConfig.mode === "all") {
    console.log("Detectando jornadas disponibles desde el selector del DOM...");
    const detected = await detectAvailableMatchdays(session, config);

    if (detected.length > 0) {
      targetMatchdays = detected;
      summary.detectionMethod = "dom";
      summary.detectedMatchdays = detected;
      console.log(`Modo barrido completo: Detectadas ${detected.length} jornadas por DOM: [${detected.join(", ")}]`);
    } else {
      summary.detectionMethod = "progressive";
      console.log("No se pudieron detectar jornadas en el DOM. Activando barrido progresivo...");
    }
  }

  const isProgressive = modeConfig.mode === "all" && summary.detectionMethod === "progressive";
  let currentIdx = 0;
  let consecutiveEmptyCount = 0;
  let hasFoundValidMatchday = false;

  while (true) {
    let j: number;

    if (isProgressive) {
      j = currentIdx + 1;
      if (j > options.maxMatchday) {
        summary.stoppedBecause = "completed";
        break;
      }
    } else {
      if (currentIdx >= targetMatchdays.length) {
        summary.stoppedBecause = "completed";
        break;
      }
      j = targetMatchdays[currentIdx];
    }

    console.log(`\n========================================`);
    console.log(`Procesando JORNADA ${j}...`);
    console.log(`========================================`);

    let html = "";
    try {
      html = await downloadJornadaHtml(session, config, j);
    } catch (err: any) {
      summary.success = false;
      summary.stoppedBecause = "fatal_error";
      summary.errors.push({ matchday: j, message: `Fallo crítico de descarga: ${err.message}` });
      console.error(`Error de red al descargar jornada ${j}. Abortando barrido.`);
      break;
    }

    const classification = classifyMatchdayResult(html, j);

    if (classification.status === "blocked") {
      // Reintentar automáticamente esperando un tiempo largo antes de rendirse
      const MAX_BLOCK_RETRIES = 2;
      const BLOCK_WAIT_MS = 3 * 60 * 1000; // 3 minutos
      let recovered = false;

      for (let attempt = 1; attempt <= MAX_BLOCK_RETRIES; attempt++) {
        const waitMin = Math.round((BLOCK_WAIT_MS * attempt) / 60_000);
        console.warn(`⚠ Bloqueo detectado en jornada ${j} (intento ${attempt}/${MAX_BLOCK_RETRIES}).`);
        console.warn(`  Esperando ${waitMin} min antes de reintentar...`);
        await sleep(BLOCK_WAIT_MS * attempt);

        // Volver a cargar la página para renovar la sesión
        const retryUrl = getJornadaUrl(config, j);
        await session.page
          .goto(retryUrl, { waitUntil: "domcontentloaded", timeout: 60_000 })
          .catch(() => null);
        await session.page.waitForTimeout(3_000);

        const retryHtml = await session.page.content().catch(() => "");
        const retryClass = classifyMatchdayResult(retryHtml, j);
        if (retryClass.status !== "blocked") {
          console.log(`  ✓ Recuperado después de espera. Continuando.`);
          html = retryHtml;
          recovered = true;
          break;
        }
      }

      if (!recovered) {
        summary.success = false;
        summary.stoppedBecause = "blocked";
        summary.errors.push({ matchday: j, message: `Bloqueo persistente tras reintentos: ${classification.reason}` });
        console.error(`✗ Bloqueo de IP confirmado. Abortando temporada ${config.season}.`);
        break;
      }

      // Re-clasificar con el HTML recuperado
      const recoveredClass = classifyMatchdayResult(html, j);
      if (recoveredClass.status === "blocked") break;
      // Continuar con el HTML recuperado (el while loop re-evaluará)
      continue;
    }

    if (classification.status === "error") {
      summary.success = false;
      summary.stoppedBecause = "fatal_error";
      summary.errors.push({ matchday: j, message: `Error de estructura: ${classification.reason}` });
      console.error(`Sincronización abortada por error en la estructura de la jornada ${j}.`);
      break;
    }

    summary.processedMatchdays.push(j);

    if (classification.status === "not_found") {
      summary.emptyMatchdays.push(j);
      console.log(`Jornada ${j} clasificada como inexistente (not_found).`);

      if (hasFoundValidMatchday) {
        consecutiveEmptyCount++;
        console.log(`Jornadas inexistentes consecutivas: ${consecutiveEmptyCount}/${options.emptyLimit}`);
        if (consecutiveEmptyCount >= options.emptyLimit) {
          summary.stoppedBecause = "consecutive_empty";
          console.log(`Deteniendo barrido: alcanzado el límite de ${options.emptyLimit} jornadas consecutivas inexistentes.`);
          break;
        }
      }

      currentIdx++;
      continue;
    }

    // El estado es 'valid'
    hasFoundValidMatchday = true;
    consecutiveEmptyCount = 0;
    summary.validMatchdays.push(j);

    const uniqueActas = classification.actaIds;
    console.log(`Jornada ${j}: Encontrados ${uniqueActas.length} partidos.`);

    const pageUrl = getJornadaUrl(config, j);

    for (const codActa of uniqueActas) {
      summary.matchesFound++;

      if (scrapedIds.has(codActa)) {
        console.log(`Partido ${codActa} ya guardado. Se omite.`);
        continue;
      }

      try {
        const pdfBuffer = await downloadPdfToMemory(session, codActa, pageUrl, config);
        const parsedMatch = await parseMatchPdf(pdfBuffer);

        if (!parsedMatch.local_team || !parsedMatch.visitor_team) {
          throw new Error(`Nombres de equipos no encontrados en el acta ${codActa}`);
        }

        console.log(`Insertando partido: ${parsedMatch.local_team} vs ${parsedMatch.visitor_team}`);
        const matchId = await saveMatchTransactional(
          codActa,
          j,
          parsedMatch,
          supabase,
          config.season,
          config.competitionName,
          config.competicion,
          config.grupo,
          pageUrl
        );

        // Actualizar la caché de scouting en la base de datos principal de forma inmediata
        try {
          const { createAdminClient } = await import("../supabase/admin");
          const mainSupabase = createAdminClient();
          const { data: orgs } = await mainSupabase
            .from("organizations")
            .select("id, settings");

          if (orgs) {
            for (const org of orgs) {
              const orgSettings = org.settings || {};
              const currentScouting = orgSettings.scouting || { matches: {} };
              const matchNode = currentScouting.matches?.[matchId] || { overrides: {}, local_staff: null, visitor_staff: null };

              matchNode.local_staff = parsedMatch.local_staff;
              matchNode.visitor_staff = parsedMatch.visitor_staff;

              if (!matchNode.overrides) matchNode.overrides = {};
              if (!matchNode.overrides.card_classifications) {
                matchNode.overrides.card_classifications = {};
              }

              for (const card of parsedMatch.cards) {
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
                    [matchId]: matchNode,
                  },
                },
              };

              await mainSupabase
                .from("organizations")
                .update({ settings: newSettings })
                .eq("id", org.id);
            }
          }
        } catch (orgErr: any) {
          console.error("  - [Scouting Cache] ERROR al registrar en Main_DB:", orgErr.message || orgErr);
        }

        scrapedIds.add(codActa);
        summary.matchesInserted++;
        console.log(`Acta ${codActa} procesada correctamente.`);
      } catch (error: any) {
        summary.matchesFailed++;
        summary.errors.push({
          matchday: j,
          federationId: codActa,
          message: error.message || "Error desconocido durante la sincronización del acta",
        });
        console.error(`Error procesando acta ${codActa}:`, error.message || error);
      }

      // Delay entre partidos (con jitter)
      await sleepJitter(options.delayMatch);
    }

    currentIdx++;

    // Delay entre jornadas
    const moreToProcess = isProgressive ? j < options.maxMatchday : currentIdx < targetMatchdays.length;
    if (moreToProcess) {
      await sleepJitter(options.delayMatchday);
    }
  }

  console.log("Scraping finalizado.");

  // Post-Proceso: Rellenar entrenadores ausentes ("No presenta") de la liga/temporada procesada
  try {
    const { createAdminClient } = await import("../supabase/admin");
    const mainSupabase = createAdminClient();
    
    console.log("Iniciando Post-Proceso de recuperación de entrenadores ausentes...");
    
    // Cargar todos los partidos de la temporada en Statistics_DB para reconstruir la cronología
    const { data: allMatches, error: allMatchesErr } = await supabase
      .from("stat_matches")
      .select("id, home_team, away_team, matchday")
      .eq("season", config.season)
      .eq("competition", config.competitionName)
      .order("matchday", { ascending: true });

    if (!allMatchesErr && allMatches && allMatches.length > 0) {
      const { data: orgs } = await mainSupabase
        .from("organizations")
        .select("id, settings");

      if (orgs) {
        for (const org of orgs) {
          const orgSettings = org.settings || {};
          const scouting = orgSettings.scouting || { matches: {} };
          const scoutingMatches = { ...(scouting.matches || {}) };
          let postProcessCount = 0;

          // Obtener equipos únicos
          const teams = new Set<string>();
          for (const m of allMatches) {
            teams.add(m.home_team);
            teams.add(m.away_team);
          }

          for (const team of teams) {
            const teamMatches = allMatches.filter(m => m.home_team === team || m.away_team === team);

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

                // Buscar hacia atrás
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

                // Buscar hacia adelante
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

            await mainSupabase
              .from("organizations")
              .update({ settings: updatedSettings })
              .eq("id", org.id);
            
            console.log(`  - [Post-Process] Completado para organización ${org.id}: ${postProcessCount} entrenadores corregidos.`);
          }
        }
      }
    }
  } catch (postErr: any) {
    console.error("  - [Post-Process] Error en recuperación de entrenadores:", postErr.message || postErr);
  }

  return summary;
}

/**
 * Versión completa del scraper: crea su propia sesión de Playwright, ejecuta
 * el núcleo y la cierra al terminar. Úsala para importar una sola temporada.
 *
 * Para importar varias temporadas de un tirón sin reabrir el navegador,
 * usa `scrape-all-seasons.ts` (que reutiliza la sesión entre temporadas).
 */
export async function runFederationScraper(
  config: CompetitionConfig,
  options: ScraperOptions,
  modeConfig: {
    mode: "single" | "range" | "all";
    jornada?: number;
    desde?: number;
    hasta?: number;
  },
  supabase: SupabaseClient
): Promise<ScraperSummary> {
  const jornadaBaseUrl =
    "https://www.rfcylf.es/pnfg/NPcd/NFG_CmpJornada" +
    "?cod_primaria=1000120" +
    `&CodCompeticion=${config.competicion}` +
    `&CodGrupo=${config.grupo}` +
    `&CodTemporada=${config.temporada}` +
    "&CodJornada=1";

  const session = await createRfcylfSession(jornadaBaseUrl);

  try {
    return await runFederationScraperCore(config, options, modeConfig, supabase, session);
  } finally {
    await closeRfcylfSession(session);
  }
}
