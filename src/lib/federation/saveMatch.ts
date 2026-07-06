import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParsedMatchReport, ParsedGoal } from "../parser/parseMatchPdf";
import crypto from "crypto";

// ============================================================
// saveMatch.ts
// Persiste una acta completa en Statistics_DB:
//   1. stat_matches
//   2. stat_lineups (con minutos entrada/salida calculados)
//   3. stat_events (goles, tarjetas, sustituciones)
//   4. stat_score_timeline (marcador en cada minuto con evento)
//   5. stat_player_match_influence (tabla pre-calculada)
// ============================================================

// ── Utilidades ───────────────────────────────────────────────

function parseSpanishDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/(\d{2})[/-](\d{2})[/-](\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function hashText(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);
}

// ── Guardar timeline de marcadores ───────────────────────────

async function saveScoreTimeline(
  matchId: string,
  goals: ParsedGoal[],
  maxMinute: number,
  supabase: SupabaseClient
): Promise<void> {
  // Ordena goles por minuto y tiempo añadido
  const sortedGoals = [...goals].sort((a, b) => {
    if (a.minute !== b.minute) return a.minute - b.minute;
    return a.extra_time - b.extra_time;
  });

  const timelineMap = new Map<number, { home: number; away: number }>();

  // Minuto 0 → marcador 0-0
  timelineMap.set(0, { home: 0, away: 0 });

  // Iterar goles y registrar el marcador acumulado tras cada uno
  for (const goal of sortedGoals) {
    const tMin = goal.minute + goal.extra_time;
    timelineMap.set(tMin, {
      home: goal.score_home_after,
      away: goal.score_away_after,
    });
  }

  // Minuto final del partido (si hay goles, el marcador del último, si no, 0-0)
  const lastScore = sortedGoals.length > 0 
    ? { home: sortedGoals[sortedGoals.length - 1].score_home_after, away: sortedGoals[sortedGoals.length - 1].score_away_after }
    : { home: 0, away: 0 };
  
  timelineMap.set(maxMinute, lastScore);

  // Transformar el Map a filas únicas
  const rows = Array.from(timelineMap.entries()).map(([minute, score]) => ({
    match_id: matchId,
    minute,
    home_score: score.home,
    away_score: score.away,
  }));

  // Upsert (evitando conflictos de claves duplicadas)
  const { error } = await supabase
    .from("stat_score_timeline")
    .upsert(rows, { onConflict: "match_id,minute" });

  if (error) throw new Error(`Error guardando score_timeline: ${error.message}`);
}

// ── Obtener marcador en un minuto concreto ────────────────────

async function getScoreAtMinute(
  matchId: string,
  minute: number,
  supabase: SupabaseClient
): Promise<{ home: number; away: number }> {
  const { data } = await supabase
    .from("stat_score_timeline")
    .select("home_score, away_score")
    .eq("match_id", matchId)
    .lte("minute", minute)
    .order("minute", { ascending: false })
    .limit(1)
    .maybeSingle();

  return { home: data?.home_score ?? 0, away: data?.away_score ?? 0 };
}

// ── Guardar alineaciones ─────────────────────────────────────

async function saveLineups(
  matchId: string,
  parsed: ParsedMatchReport,
  supabase: SupabaseClient
): Promise<void> {
  const allPlayers = [
    ...parsed.local_players.map((p) => ({ ...p, team: parsed.local_team! })),
    ...parsed.visitor_players.map((p) => ({ ...p, team: parsed.visitor_team! })),
  ];

  for (const player of allPlayers) {
    const teamSide = player.team === parsed.local_team ? "local" : "visitor";

    let subInMin  = 0;
    let subOutMin = 90;

    if (player.is_starter) {
      // Busca si fue sustituido
      const subOut = parsed.substitutions.find(
        (s) => s.team === teamSide && s.out_number === player.number
      );
      if (subOut) subOutMin = subOut.minute + subOut.extra_time;
    } else {
      // Suplente: busca cuándo entró
      const subIn = parsed.substitutions.find(
        (s) => s.team === teamSide && s.in_number === player.number
      );
      if (subIn) {
        subInMin  = subIn.minute + subIn.extra_time;
        subOutMin = 90;

        // ¿Fue sustituido después de entrar?
        const subOut = parsed.substitutions.find(
          (s) =>
            s.team === teamSide &&
            s.out_number === player.number &&
            s.minute > subIn.minute
        );
        if (subOut) subOutMin = subOut.minute + subOut.extra_time;
      } else {
        // Suplente que no llegó a entrar
        subInMin  = 0;
        subOutMin = 0;
      }
    }

    // Expulsión: si tiene roja, salió en ese minuto
    const redCard = parsed.cards.find(
      (c) =>
        c.team === teamSide &&
        (c.type === "roja" || c.type === "doble amarilla") &&
        c.player_name.toLowerCase().includes(player.name.split(" ")[0].toLowerCase())
    );
    if (redCard && redCard.minute < subOutMin) {
      subOutMin = redCard.minute + redCard.extra_time;
    }

    const { error } = await supabase.from("stat_lineups").upsert(
      {
        match_id: matchId,
        team_name: player.team,
        player_name: player.name,
        shirt_number: player.number,
        is_starter: player.is_starter,
        substituted_in_min: subInMin,
        substituted_out_min: subOutMin,
      },
      { onConflict: "match_id,team_name,player_name" }
    );

    if (error) {
      throw new Error(
        `Error guardando alineación de ${player.name} (${player.team}): ${error.message}`
      );
    }
  }
}

// ── Guardar eventos ──────────────────────────────────────────

async function saveEvents(
  matchId: string,
  parsed: ParsedMatchReport,
  supabase: SupabaseClient
): Promise<void> {
  const rows: any[] = [];

  // Goles
  for (const goal of parsed.goals) {
    const teamName = goal.team === "local" ? parsed.local_team! : parsed.visitor_team!;
    let eventType: string;
    if (goal.type === "own_goal") eventType = "own_goal";
    else if (goal.type === "penalty") eventType = "penalty_goal";
    else eventType = "goal";

    rows.push({
      match_id: matchId,
      event_type: eventType,
      team_name: teamName,
      player_name: goal.player_name,
      minute: goal.minute,
      extra_time: goal.extra_time,
      score_home_after: goal.score_home_after,
      score_away_after: goal.score_away_after,
    });
  }

  // Tarjetas
  for (const card of parsed.cards) {
    const teamName = card.team === "local" ? parsed.local_team! : parsed.visitor_team!;
    let eventType: string;
    if (card.type === "roja") eventType = "red_card";
    else if (card.type === "doble amarilla") eventType = "yellow_red_card";
    else eventType = "yellow_card";

    rows.push({
      match_id: matchId,
      event_type: eventType,
      team_name: teamName,
      player_name: card.player_name,
      minute: card.minute,
      extra_time: card.extra_time,
    });
  }

  // Sustituciones (guardamos entrada y salida como eventos separados)
  for (const sub of parsed.substitutions) {
    const teamName = sub.team === "local" ? parsed.local_team! : parsed.visitor_team!;

    rows.push({
      match_id: matchId,
      event_type: "substitution_in",
      team_name: teamName,
      player_name: sub.in_name,
      minute: sub.minute,
      extra_time: sub.extra_time,
      detail: `Entra por ${sub.out_name} (${sub.out_number})`,
    });

    rows.push({
      match_id: matchId,
      event_type: "substitution_out",
      team_name: teamName,
      player_name: sub.out_name,
      minute: sub.minute,
      extra_time: sub.extra_time,
      detail: `Sale. Entra ${sub.in_name} (${sub.in_number})`,
    });
  }

  if (rows.length === 0) return;

  const { error } = await supabase.from("stat_events").insert(rows);
  if (error) throw new Error(`Error guardando eventos: ${error.message}`);
}

// ── Calcular influencia de jugadores ─────────────────────────

async function savePlayerInfluence(
  matchId: string,
  parsed: ParsedMatchReport,
  supabase: SupabaseClient
): Promise<void> {
  // Obtener lineups guardados (necesitamos sus IDs)
  const { data: lineups, error: lineupError } = await supabase
    .from("stat_lineups")
    .select("*")
    .eq("match_id", matchId);

  if (lineupError) throw new Error(`Error cargando lineups para influencia: ${lineupError.message}`);
  if (!lineups || lineups.length === 0) return;

  const rows: any[] = [];

  for (const lineup of lineups) {
    const isHome    = lineup.team_name === parsed.local_team;
    const teamScore = isHome ? parsed.goals_local    : parsed.goals_visitor;
    const oppScore  = isHome ? parsed.goals_visitor  : parsed.goals_local;
    const result    = teamScore > oppScore ? "win" : teamScore < oppScore ? "loss" : "draw";

    const inMin  = lineup.substituted_in_min  as number;
    const outMin = lineup.substituted_out_min as number;

    // Marcador cuando el jugador entró
    const scoreAtEntry = await getScoreAtMinute(matchId, inMin, supabase);
    const scoreAtExit  = await getScoreAtMinute(matchId, outMin, supabase);

    // Goles a favor mientras estaba en campo
    const goalsForOn = parsed.goals.filter(
      (g) =>
        (g.team === "local") === isHome &&
        g.type !== "own_goal" &&
        g.minute + g.extra_time >= inMin &&
        g.minute + g.extra_time < outMin
    ).length;

    // Goles en contra mientras estaba en campo
    const goalsAgainstOn = parsed.goals.filter(
      (g) =>
        ((g.team === "local") !== isHome && g.type !== "own_goal") ||
        ((g.team === "local") === isHome && g.type === "own_goal")
    ).filter(
      (g) =>
        g.minute + g.extra_time >= inMin &&
        g.minute + g.extra_time < outMin
    ).length;

    // Goles a favor mientras NO estaba en campo
    const goalsForOff = parsed.goals.filter(
      (g) =>
        (g.team === "local") === isHome &&
        g.type !== "own_goal" &&
        (g.minute + g.extra_time < inMin || g.minute + g.extra_time >= outMin)
    ).length;

    // Goles en contra mientras NO estaba en campo
    const goalsAgainstOff = parsed.goals.filter(
      (g) =>
        ((g.team === "local") !== isHome && g.type !== "own_goal") ||
        ((g.team === "local") === isHome && g.type === "own_goal")
    ).filter(
      (g) =>
        g.minute + g.extra_time < inMin || g.minute + g.extra_time >= outMin
    ).length;

    // Goles propios del jugador
    const goalsScored = parsed.goals.filter(
      (g) =>
        g.type === "normal" &&
        g.player_name.toLowerCase().includes(lineup.player_name.split(" ")[0].toLowerCase()) &&
        (g.team === "local") === isHome
    ).length;

    const ownGoals = parsed.goals.filter(
      (g) =>
        g.type === "own_goal" &&
        g.player_name.toLowerCase().includes(lineup.player_name.split(" ")[0].toLowerCase())
    ).length;

    const penaltiesScored = parsed.goals.filter(
      (g) =>
        g.type === "penalty" &&
        g.player_name.toLowerCase().includes(lineup.player_name.split(" ")[0].toLowerCase()) &&
        (g.team === "local") === isHome
    ).length;

    // Tarjetas
    const yellowCards = parsed.cards.filter(
      (c) =>
        c.type === "amarilla" &&
        c.player_name.toLowerCase().includes(lineup.player_name.split(" ")[0].toLowerCase())
    ).length;

    const redCards = parsed.cards.filter(
      (c) =>
        (c.type === "roja" || c.type === "doble amarilla") &&
        c.player_name.toLowerCase().includes(lineup.player_name.split(" ")[0].toLowerCase())
    ).length;

    rows.push({
      match_id: matchId,
      lineup_id: lineup.id,
      player_name: lineup.player_name,
      main_db_player_id: lineup.main_db_player_id ?? null,
      team_name: lineup.team_name,
      season: parsed.jornada ? `${parsed.jornada}` : null, // se sobreescribirá abajo
      is_starter: lineup.is_starter,
      minutes_on: Math.max(0, outMin - inMin),
      substituted_in_min: inMin,
      substituted_out_min: outMin,
      score_home_at_entry: scoreAtEntry.home,
      score_away_at_entry: scoreAtEntry.away,
      score_home_at_exit: scoreAtExit.home,
      score_away_at_exit: scoreAtExit.away,
      goals_for_while_on: goalsForOn,
      goals_against_while_on: goalsAgainstOn,
      goals_for_while_off: goalsForOff,
      goals_against_while_off: goalsAgainstOff,
      goals_scored: goalsScored,
      own_goals: ownGoals,
      penalties_scored: penaltiesScored,
      yellow_cards: yellowCards,
      red_cards: redCards,
      team_result: result,
      team_goals_scored: teamScore,
      team_goals_conceded: oppScore,
    });
  }

  const { error } = await supabase
    .from("stat_player_match_influence")
    .upsert(rows, { onConflict: "match_id,lineup_id" });

  if (error) throw new Error(`Error guardando influencia: ${error.message}`);
}

// ── Rollback ─────────────────────────────────────────────────

async function rollbackMatch(matchId: string, supabase: SupabaseClient): Promise<void> {
  // Borrar en orden inverso de FK
  await supabase.from("stat_player_match_influence").delete().eq("match_id", matchId);
  await supabase.from("stat_score_timeline").delete().eq("match_id", matchId);
  await supabase.from("stat_events").delete().eq("match_id", matchId);
  await supabase.from("stat_lineups").delete().eq("match_id", matchId);
  await supabase.from("stat_matches").delete().eq("id", matchId);
}

// ── Función principal ────────────────────────────────────────

export async function saveMatchTransactional(
  codActa: string,
  jornada: number,
  parsed: ParsedMatchReport,
  supabase: SupabaseClient,
  season: string,
  competitionName: string,
  competitionCode?: string,
  groupCode?: string,
  matchdayUrl?: string,
  rawText?: string
): Promise<string> {
  const matchDate = parseSpanishDate(parsed.date);

  // 1. Insertar partido
  const { data: insertedMatch, error: matchError } = await supabase
    .from("stat_matches")
    .insert({
      federation_id: codActa,
      competition: competitionName,
      competition_code: competitionCode ?? null,
      group_code: groupCode ?? null,
      season,
      matchday: jornada,
      match_date: matchDate,
      venue: parsed.campo ?? null,
      home_team: parsed.local_team!,
      away_team: parsed.visitor_team!,
      home_score: parsed.goals_local,
      away_score: parsed.goals_visitor,
      home_score_ht: parsed.goals_local_ht ?? null,
      away_score_ht: parsed.goals_visitor_ht ?? null,
      matchday_url: matchdayUrl ?? null,
      raw_text_hash: rawText ? hashText(rawText) : null,
    })
    .select("id")
    .single();

  if (matchError || !insertedMatch) {
    throw new Error(
      `No se pudo insertar el partido ${codActa}: ${matchError?.message ?? "sin respuesta"}`
    );
  }

  const matchId = insertedMatch.id;

  try {
    // 2. Alineaciones
    await saveLineups(matchId, parsed, supabase);

    // 3. Eventos
    await saveEvents(matchId, parsed, supabase);

    // 4. Timeline de marcadores
    const maxMinute = Math.max(90, ...parsed.goals.map((g) => g.minute + g.extra_time));
    await saveScoreTimeline(matchId, parsed.goals, maxMinute, supabase);

    // 5. Influencia por jugador (actualizar season en los rows)
    // Necesitamos el season para la influencia — lo pasamos via una pequeña patch
    await savePlayerInfluenceWithSeason(matchId, parsed, season, matchDate, supabase);

    return matchId;
  } catch (err) {
    console.error(`  ✗ Partido ${codActa} incompleto. Revirtiendo...`);
    await rollbackMatch(matchId, supabase);
    throw err;
  }
}

// Wrapper que añade season y match_date a los rows de influencia
async function savePlayerInfluenceWithSeason(
  matchId: string,
  parsed: ParsedMatchReport,
  season: string,
  matchDate: string | null,
  supabase: SupabaseClient
): Promise<void> {
  const { data: lineups, error: lineupError } = await supabase
    .from("stat_lineups")
    .select("*")
    .eq("match_id", matchId);

  if (lineupError) throw new Error(`Error cargando lineups: ${lineupError.message}`);
  if (!lineups || lineups.length === 0) return;

  const rows: any[] = [];

  for (const lineup of lineups) {
    const isHome    = lineup.team_name === parsed.local_team;
    const teamScore = isHome ? parsed.goals_local   : parsed.goals_visitor;
    const oppScore  = isHome ? parsed.goals_visitor : parsed.goals_local;
    const result    = teamScore > oppScore ? "win" : teamScore < oppScore ? "loss" : "draw";

    const inMin  = lineup.substituted_in_min  as number;
    const outMin = lineup.substituted_out_min as number;

    const scoreAtEntry = await getScoreAtMinute(matchId, inMin, supabase);
    const scoreAtExit  = await getScoreAtMinute(matchId, outMin, supabase);

    const firstName = lineup.player_name.split(" ")[0].toLowerCase();

    const goalsForOn = parsed.goals.filter(
      (g) =>
        (g.team === "local") === isHome &&
        g.type !== "own_goal" &&
        g.minute + g.extra_time >= inMin &&
        g.minute + g.extra_time < outMin
    ).length;

    const goalsAgainstOn = parsed.goals.filter((g) => {
      const isGoalForOpponent =
        (g.team === "local") !== isHome && g.type !== "own_goal";
      const isOwnGoal =
        (g.team === "local") === isHome && g.type === "own_goal";
      return (
        (isGoalForOpponent || isOwnGoal) &&
        g.minute + g.extra_time >= inMin &&
        g.minute + g.extra_time < outMin
      );
    }).length;

    const goalsForOff = parsed.goals.filter(
      (g) =>
        (g.team === "local") === isHome &&
        g.type !== "own_goal" &&
        (g.minute + g.extra_time < inMin || g.minute + g.extra_time >= outMin)
    ).length;

    const goalsAgainstOff = parsed.goals.filter((g) => {
      const isGoalForOpponent =
        (g.team === "local") !== isHome && g.type !== "own_goal";
      const isOwnGoal =
        (g.team === "local") === isHome && g.type === "own_goal";
      return (
        (isGoalForOpponent || isOwnGoal) &&
        (g.minute + g.extra_time < inMin || g.minute + g.extra_time >= outMin)
      );
    }).length;

    const goalsScored = parsed.goals.filter(
      (g) =>
        g.type === "normal" &&
        g.player_name.toLowerCase().includes(firstName) &&
        (g.team === "local") === isHome
    ).length;

    const ownGoals = parsed.goals.filter(
      (g) =>
        g.type === "own_goal" &&
        g.player_name.toLowerCase().includes(firstName)
    ).length;

    const penaltiesScored = parsed.goals.filter(
      (g) =>
        g.type === "penalty" &&
        g.player_name.toLowerCase().includes(firstName) &&
        (g.team === "local") === isHome
    ).length;

    const yellowCards = parsed.cards.filter(
      (c) => c.type === "amarilla" && c.player_name.toLowerCase().includes(firstName)
    ).length;

    const redCards = parsed.cards.filter(
      (c) =>
        (c.type === "roja" || c.type === "doble amarilla") &&
        c.player_name.toLowerCase().includes(firstName)
    ).length;

    rows.push({
      match_id: matchId,
      lineup_id: lineup.id,
      player_name: lineup.player_name,
      main_db_player_id: lineup.main_db_player_id ?? null,
      team_name: lineup.team_name,
      season,
      match_date: matchDate,
      is_starter: lineup.is_starter,
      minutes_on: Math.max(0, outMin - inMin),
      substituted_in_min: inMin,
      substituted_out_min: outMin,
      score_home_at_entry: scoreAtEntry.home,
      score_away_at_entry: scoreAtEntry.away,
      score_home_at_exit: scoreAtExit.home,
      score_away_at_exit: scoreAtExit.away,
      goals_for_while_on: goalsForOn,
      goals_against_while_on: goalsAgainstOn,
      goals_for_while_off: goalsForOff,
      goals_against_while_off: goalsAgainstOff,
      goals_scored: goalsScored,
      own_goals: ownGoals,
      penalties_scored: penaltiesScored,
      yellow_cards: yellowCards,
      red_cards: redCards,
      team_result: result,
      team_goals_scored: teamScore,
      team_goals_conceded: oppScore,
    });
  }

  const { error } = await supabase
    .from("stat_player_match_influence")
    .upsert(rows, { onConflict: "match_id,lineup_id" });

  if (error) throw new Error(`Error guardando influencia: ${error.message}`);
}
