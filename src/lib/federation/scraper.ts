import type { SupabaseClient } from "@supabase/supabase-js";
import { parseMatchPdf } from "../parser/parseMatchPdf";
import {
  createRfcylfSession,
  closeRfcylfSession,
  type RfcylfSession,
} from "../../../scripts/rfcylf-browser";
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
        const pdfBuffer = await downloadPdfToMemory(session, codActa, pageUrl);
        const parsedMatch = await parseMatchPdf(pdfBuffer);

        if (!parsedMatch.local_team || !parsedMatch.visitor_team) {
          throw new Error(`Nombres de equipos no encontrados en el acta ${codActa}`);
        }

        console.log(`Insertando partido: ${parsedMatch.local_team} vs ${parsedMatch.visitor_team}`);
        await saveMatchTransactional(
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
