// ============================================================
// rivalAnalysisEngine.ts
// Motor de análisis en memoria para scouting del rival
// ============================================================

export interface RivalAnalysisResult {
  rivalName: string;
  season: string;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;

  squad: {
    irc: number; // Squad Rotation Index (average changes)
    rfo: number; // Lineup Frequency Ratio
    iji: number; // Important Players Index
    intocables: Array<{ name: string; minutes: number; percentage: number }>;
    stablePairs: {
      centrales: { players: string[]; startsTogether: number; percentage: number } | null;
      pivotes: { players: string[]; startsTogether: number; percentage: number } | null;
      delanteros: { players: string[]; startsTogether: number; percentage: number } | null;
    };
  };

  coach: {
    reactionWindow: number; // average minute of 1st sub
    benchUsage: number; // average number of subs used
    frequentSubs: Array<{ name: string; count: number }>;
    staff: {
      coach: string | null;
      assistant: string | null;
      physio: string | null;
      fitness_coach: string | null;
      delegate: string | null;
    } | null;
  };

  dynamics: {
    goalClusters: {
      scored: number[]; // 6 buckets
      conceded: number[]; // 6 buckets
    };
    resilienceIndex: number; // % of points won after conceding first
    comebacks: number; // trailing turned to winning
    chaosMinutes: string;
    timeLeading: {
      winning: number; // percentage of minutes
      drawing: number;
      losing: number;
    };
  };

  discipline: {
    cardsFirstHalf: number;
    cardsSecondHalf: number;
    protestRatio: number; // cards for protest / total cards
    violenceRatio: number; // cards for violence / total cards
    lanceRatio: number; // tactical/lance / total cards
  };

  attack: {
    goalscorerDistribution: {
      defenders: number;
      midfielders: number;
      forwards: number;
    };
    goalDependency: {
      top1: { name: string; goals: number; percentage: number } | null;
      top2: { name: string; goals: number; percentage: number } | null;
    };
  };

  executiveReport: string;
}

export function calculateRivalAnalysis(
  rivalName: string,
  season: string,
  matches: any[],
  lineups: any[],
  events: any[],
  orgSettings: any
): RivalAnalysisResult {
  const cleanRivalName = rivalName.toLowerCase().trim();

  // 1. Filtrar y ordenar partidos del rival
  const rivalMatches = matches
    .filter(
      (m) =>
        m.home_team.toLowerCase().trim() === cleanRivalName ||
        m.away_team.toLowerCase().trim() === cleanRivalName
    )
    .sort((a, b) => a.matchday - b.matchday);

  const totalMatches = rivalMatches.length;

  let wins = 0;
  let draws = 0;
  let losses = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;

  for (const m of rivalMatches) {
    const isHome = m.home_team.toLowerCase().trim() === cleanRivalName;
    const tScore = isHome ? m.home_score : m.away_score;
    const oScore = isHome ? m.away_score : m.home_score;

    if (tScore !== null && oScore !== null) {
      goalsFor += tScore;
      goalsAgainst += oScore;
      if (tScore > oScore) wins++;
      else if (tScore < oScore) losses++;
      else draws++;
    }
  }
  const points = wins * 3 + draws;

  // Cargar overrides del namespace `scouting`
  const scoutingMatches = orgSettings?.scouting?.matches || {};

  // Helper para normalizar nombres
  const normalizeName = (name: string) =>
    name
      .toUpperCase()
      .replace(/[^A-ZÁÉÍÓÚÑ ]/g, "")
      .trim();

  // Helper para clasificar la posición de un jugador
  const getPlayerPositionCategory = (playerName: string, matchId: string) => {
    // 1. Mirar override de la Main DB
    const overridePos = scoutingMatches[matchId]?.overrides?.player_positions?.[playerName];
    if (overridePos) {
      const posUpper = overridePos.toUpperCase();
      if (posUpper.includes("CENTRAL") || posUpper.includes("CB") || posUpper.includes("DEFENSA")) return "DF";
      if (posUpper.includes("PIVOTE") || posUpper.includes("DM") || posUpper.includes("MEDIO") || posUpper.includes("CENTRO")) return "MF";
      if (posUpper.includes("DELANTERO") || posUpper.includes("FW") || posUpper.includes("EXTREMO") || posUpper.includes("PUNTA")) return "FW";
      return "MF";
    }

    // 2. Mirar en lineups de la base de datos de estadísticas
    const lp = lineups.find(
      (l) => l.match_id === matchId && l.team_name.toLowerCase().trim() === cleanRivalName && l.player_name === playerName
    );
    if (lp?.position) {
      const posUpper = lp.position.toUpperCase();
      if (posUpper.includes("PORTERO") || posUpper.includes("GOALKEEPER")) return "GK";
      if (posUpper.includes("DEFENSA") || posUpper.includes("CB")) return "DF";
      if (posUpper.includes("CENTRO") || posUpper.includes("PIVOTE") || posUpper.includes("MF")) return "MF";
      if (posUpper.includes("DELANTERO") || posUpper.includes("FW")) return "FW";
    }

    // 3. Fallback basado en el dorsal
    const shirt = lp?.shirt_number;
    if (shirt) {
      if (shirt === 1 || shirt === 13 || shirt === 25) return "GK";
      if (shirt >= 2 && shirt <= 5) return "DF";
      if (shirt === 6 || shirt === 8 || shirt === 10 || shirt === 14 || shirt === 16) return "MF";
      if (shirt === 7 || shirt === 9 || shirt === 11 || shirt === 17 || shirt === 19 || shirt === 21) return "FW";
    }
    return "MF"; // Default
  };

  // ═══ 1. SQUAD METRICS ═══

  // Obtener onces iniciales
  const startingXIs = rivalMatches.map((m) =>
    lineups
      .filter(
        (l) =>
          l.match_id === m.id &&
          l.team_name.toLowerCase().trim() === cleanRivalName &&
          l.is_starter
      )
      .map((l) => l.player_name)
  );

  // IRC (Squad Rotation Index)
  let totalChanges = 0;
  let rotationPairsCount = 0;
  for (let i = 0; i < startingXIs.length - 1; i++) {
    const s1 = startingXIs[i];
    const s2 = startingXIs[i + 1];
    if (s1.length > 0 && s2.length > 0) {
      // Cuántos de s2 NO están en s1
      const changes = s2.filter((p) => !s1.includes(p)).length;
      totalChanges += changes;
      rotationPairsCount++;
    }
  }
  const irc = rotationPairsCount > 0 ? parseFloat((totalChanges / rotationPairsCount).toFixed(2)) : 0;

  // IJI (Important Players Index)
  const startsCount: Record<string, number> = {};
  for (const xi of startingXIs) {
    for (const player of xi) {
      startsCount[player] = (startsCount[player] || 0) + 1;
    }
  }
  const sortedStarters = Object.entries(startsCount).sort((a, b) => b[1] - a[1]);
  const top11Starts = sortedStarters.slice(0, 11).reduce((acc, curr) => acc + curr[1], 0);
  const totalStartsPossible = totalMatches * 11;
  const iji = totalStartsPossible > 0 ? parseFloat(((top11Starts / totalStartsPossible) * 100).toFixed(1)) : 0;

  // RFO (Lineup Frequency Ratio)
  // Contar cuántas veces se repite el once idéntico (normalizado)
  const lineupFingerprints: Record<string, number> = {};
  for (const xi of startingXIs) {
    if (xi.length === 11) {
      const fingerprint = [...xi].sort().join("|");
      lineupFingerprints[fingerprint] = (lineupFingerprints[fingerprint] || 0) + 1;
    }
  }
  const maxLineupRepetitions = Object.values(lineupFingerprints).reduce((max, val) => (val > max ? val : max), 0);
  const rfo = totalMatches > 0 ? parseFloat(((maxLineupRepetitions / totalMatches) * 100).toFixed(1)) : 0;

  // Intocables (>= 80% de minutos)
  const totalMinutesPossible = totalMatches * 90;
  const playerMinutes: Record<string, number> = {};
  for (const m of rivalMatches) {
    const matchLineups = lineups.filter(
      (l) => l.match_id === m.id && l.team_name.toLowerCase().trim() === cleanRivalName
    );
    for (const l of matchLineups) {
      playerMinutes[l.player_name] = (playerMinutes[l.player_name] || 0) + (l.minutes_on || 0);
    }
  }
  const intocables = Object.entries(playerMinutes)
    .map(([name, mins]) => ({
      name,
      minutes: mins,
      percentage: totalMinutesPossible > 0 ? parseFloat(((mins / totalMinutesPossible) * 100).toFixed(1)) : 0,
    }))
    .filter((p) => p.percentage >= 80)
    .sort((a, b) => b.minutes - a.minutes);

  // Parejas estables
  // Contar cuántas veces empiezan juntos dos jugadores del mismo sector
  const CB_starts: Record<string, number> = {};
  const DM_starts: Record<string, number> = {};
  const FW_starts: Record<string, number> = {};

  for (const m of rivalMatches) {
    const starters = lineups.filter(
      (l) => l.match_id === m.id && l.team_name.toLowerCase().trim() === cleanRivalName && l.is_starter
    );

    const cbs = starters.filter((s) => getPlayerPositionCategory(s.player_name, m.id) === "DF").map((s) => s.player_name);
    const dms = starters.filter((s) => getPlayerPositionCategory(s.player_name, m.id) === "MF").map((s) => s.player_name);
    const fws = starters.filter((s) => getPlayerPositionCategory(s.player_name, m.id) === "FW").map((s) => s.player_name);

    const countPairs = (list: string[], record: Record<string, number>) => {
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const pair = [list[i], list[j]].sort().join(" & ");
          record[pair] = (record[pair] || 0) + 1;
        }
      }
    };

    countPairs(cbs, CB_starts);
    countPairs(dms, DM_starts);
    countPairs(fws, FW_starts);
  }

  const getTopPair = (record: Record<string, number>) => {
    const sorted = Object.entries(record).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) return null;
    return {
      players: sorted[0][0].split(" & "),
      startsTogether: sorted[0][1],
      percentage: totalMatches > 0 ? parseFloat(((sorted[0][1] / totalMatches) * 100).toFixed(1)) : 0,
    };
  };

  const stablePairs = {
    centrales: getTopPair(CB_starts),
    pivotes: getTopPair(DM_starts),
    delanteros: getTopPair(FW_starts),
  };

  // ═══ 2. COACH METRICS ═══

  let firstSubMinutesSum = 0;
  let matchesWithSubs = 0;
  let totalSubsUsed = 0;
  const subInCounts: Record<string, number> = {};

  for (const m of rivalMatches) {
    const subInEvents = events
      .filter(
        (e) =>
          e.match_id === m.id &&
          e.team_name.toLowerCase().trim() === cleanRivalName &&
          e.event_type === "substitution_in"
      )
      .sort((a, b) => a.minute - b.minute);

    if (subInEvents.length > 0) {
      firstSubMinutesSum += subInEvents[0].minute;
      matchesWithSubs++;
    }
    totalSubsUsed += subInEvents.length;

    for (const e of subInEvents) {
      subInCounts[e.player_name] = (subInCounts[e.player_name] || 0) + 1;
    }
  }

  const reactionWindow = matchesWithSubs > 0 ? Math.round(firstSubMinutesSum / matchesWithSubs) : 0;
  const benchUsage = totalMatches > 0 ? parseFloat((totalSubsUsed / totalMatches).toFixed(1)) : 0;
  const frequentSubs = Object.entries(subInCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Obtener cuerpo técnico del partido más reciente
  let staff: RivalAnalysisResult["coach"]["staff"] = null;
  if (rivalMatches.length > 0) {
    const latestMatch = rivalMatches[rivalMatches.length - 1];
    const isHome = latestMatch.home_team.toLowerCase().trim() === cleanRivalName;
    const matchScouting = scoutingMatches[latestMatch.id];
    
    if (matchScouting) {
      const parsedStaff = isHome ? matchScouting.local_staff : matchScouting.visitor_staff;
      if (parsedStaff) {
        staff = {
          coach: parsedStaff.coach || null,
          assistant: parsedStaff.assistant || null,
          physio: parsedStaff.physio || null,
          fitness_coach: parsedStaff.fitness_coach || null,
          delegate: parsedStaff.delegate || null,
        };
      }
    }
  }

  // ═══ 3. DYNAMICS METRICS ═══

  // Buckets de 15 minutos: 0-15, 16-30, 31-45, 46-60, 61-75, 76-90+
  const scoredClusters = [0, 0, 0, 0, 0, 0];
  const concededClusters = [0, 0, 0, 0, 0, 0];

  const getClusterIndex = (min: number) => {
    if (min <= 15) return 0;
    if (min <= 30) return 1;
    if (min <= 45) return 2;
    if (min <= 60) return 3;
    if (min <= 75) return 4;
    return 5;
  };

  let comebacks = 0;
  let gamesConcededFirst = 0;
  let pointsWonConcededFirst = 0;

  let totalWinMinutes = 0;
  let totalDrawMinutes = 0;
  let totalLoseMinutes = 0;

  // Para contar el caos (goles + tarjetas + cambios en partidos del rival)
  const clusterEventCounts = [0, 0, 0, 0, 0, 0];

  for (const m of rivalMatches) {
    const isHome = m.home_team.toLowerCase().trim() === cleanRivalName;
    const matchEvents = events
      .filter((e) => e.match_id === m.id)
      .sort((a, b) => {
        if (a.minute !== b.minute) return a.minute - b.minute;
        return a.extra_time - b.extra_time;
      });

    // 1. Clusters de goles y eventos de caos
    const goalEvents = matchEvents.filter((e) =>
      ["goal", "own_goal", "penalty_goal"].includes(e.event_type)
    );
    for (const ge of goalEvents) {
      const idx = getClusterIndex(ge.minute);
      clusterEventCounts[idx]++;

      const isRivalGoal =
        (ge.team_name.toLowerCase().trim() === cleanRivalName && ge.event_type !== "own_goal") ||
        (ge.team_name.toLowerCase().trim() !== cleanRivalName && ge.event_type === "own_goal");

      if (isRivalGoal) {
        scoredClusters[idx]++;
      } else {
        concededClusters[idx]++;
      }
    }

    // Registrar cambios y tarjetas en el índice de caos
    const otherEventsForChaos = matchEvents.filter((e) =>
      ["yellow_card", "red_card", "yellow_red_card", "substitution_in"].includes(e.event_type)
    );
    for (const e of otherEventsForChaos) {
      clusterEventCounts[getClusterIndex(e.minute)]++;
    }

    // 2. Resilience y Comebacks
    let concededFirst = false;
    let rivalEverTrailing = false;
    let firstGoalDetected = false;

    for (const ge of goalEvents) {
      const scoreHome = ge.score_home_after ?? 0;
      const scoreAway = ge.score_away_after ?? 0;

      const rivalScore = isHome ? scoreHome : scoreAway;
      const oppScore = isHome ? scoreAway : scoreHome;

      if (!firstGoalDetected) {
        firstGoalDetected = true;
        const isRivalGoal =
          (ge.team_name.toLowerCase().trim() === cleanRivalName && ge.event_type !== "own_goal") ||
          (ge.team_name.toLowerCase().trim() !== cleanRivalName && ge.event_type === "own_goal");
        if (!isRivalGoal) {
          concededFirst = true;
        }
      }

      if (rivalScore < oppScore) {
        rivalEverTrailing = true;
      }
    }

    const teamScore = isHome ? m.home_score : m.away_score;
    const oppScore = isHome ? m.away_score : m.home_score;
    if (teamScore !== null && oppScore !== null) {
      const won = teamScore > oppScore;
      if (concededFirst) {
        gamesConcededFirst++;
        pointsWonConcededFirst += won ? 3 : teamScore === oppScore ? 1 : 0;
      }
      if (rivalEverTrailing && won) {
        comebacks++;
      }
    }

    // 3. Time Leading
    let currentRivalScore = 0;
    let currentOppScore = 0;
    let lastMin = 0;

    for (const ge of goalEvents) {
      const duration = ge.minute - lastMin;
      if (duration > 0) {
        if (currentRivalScore > currentOppScore) totalWinMinutes += duration;
        else if (currentRivalScore < currentOppScore) totalLoseMinutes += duration;
        else totalDrawMinutes += duration;
      }

      const isRivalGoal =
        (ge.team_name.toLowerCase().trim() === cleanRivalName && ge.event_type !== "own_goal") ||
        (ge.team_name.toLowerCase().trim() !== cleanRivalName && ge.event_type === "own_goal");

      if (isRivalGoal) {
        currentRivalScore++;
      } else {
        currentOppScore++;
      }
      lastMin = ge.minute;
    }
    // Añadir tiempo restante hasta el 90
    const remaining = 90 - lastMin;
    if (remaining > 0) {
      if (currentRivalScore > currentOppScore) totalWinMinutes += remaining;
      else if (currentRivalScore < currentOppScore) totalLoseMinutes += remaining;
      else totalDrawMinutes += remaining;
    }
  }

  const resilienceIndex = gamesConcededFirst > 0 ? parseFloat(((pointsWonConcededFirst / (gamesConcededFirst * 3)) * 100).toFixed(1)) : 0;

  const totalTimeMin = totalWinMinutes + totalDrawMinutes + totalLoseMinutes;
  const timeLeading = {
    winning: totalTimeMin > 0 ? parseFloat(((totalWinMinutes / totalTimeMin) * 100).toFixed(1)) : 0,
    drawing: totalTimeMin > 0 ? parseFloat(((totalDrawMinutes / totalTimeMin) * 100).toFixed(1)) : 0,
    losing: totalTimeMin > 0 ? parseFloat(((totalLoseMinutes / totalTimeMin) * 100).toFixed(1)) : 0,
  };

  const clusterLabels = ["0-15'", "16-30'", "31-45'", "46-60'", "61-75'", "76-90+'"];
  const maxChaosIdx = clusterEventCounts.reduce((maxIdx, val, idx, arr) => (val > arr[maxIdx] ? idx : maxIdx), 0);
  const chaosMinutes = clusterLabels[maxChaosIdx];

  // ═══ 4. DISCIPLINE METRICS ═══

  let cardsFirstHalf = 0;
  let cardsSecondHalf = 0;
  let totalCards = 0;
  let protestCards = 0;
  let violenceCards = 0;
  let lanceCards = 0;

  for (const m of rivalMatches) {
    const cardEvents = events.filter(
      (e) =>
        e.match_id === m.id &&
        e.team_name.toLowerCase().trim() === cleanRivalName &&
        ["yellow_card", "red_card", "yellow_red_card"].includes(e.event_type)
    );

    const matchScouting = scoutingMatches[m.id];
    const cardClassifications = matchScouting?.overrides?.card_classifications || {};

    for (const card of cardEvents) {
      totalCards++;
      if (card.minute <= 45) cardsFirstHalf++;
      else cardsSecondHalf++;

      // Generar la clave única de la tarjeta: playerName-minute
      // e.g. "JORGE-48"
      const cardKey = `${card.player_name}-${card.minute}`;
      const classification = cardClassifications[cardKey] || cardClassifications[card.player_name] || null;

      if (classification === "protesta") {
        protestCards++;
      } else if (classification === "violencia") {
        violenceCards++;
      } else if (classification === "lance") {
        lanceCards++;
      } else {
        // Fallback al motivo auto-detectado en la base de datos si existe en los detalles
        const detailsLower = card.detail?.toLowerCase() || "";
        const protestKeywords = ["protestar", "protestas", "dirigirse a mí", "desconsideración", "observación"];
        const violenceKeywords = ["golpear", "empujar", "insultar", "agredir", "conducta violenta", "puño", "patada"];
        
        if (protestKeywords.some((k) => detailsLower.includes(k))) {
          protestCards++;
        } else if (violenceKeywords.some((k) => detailsLower.includes(k))) {
          violenceCards++;
        } else {
          lanceCards++;
        }
      }
    }
  }

  const protestRatio = totalCards > 0 ? parseFloat(((protestCards / totalCards) * 100).toFixed(1)) : 0;
  const violenceRatio = totalCards > 0 ? parseFloat(((violenceCards / totalCards) * 100).toFixed(1)) : 0;
  const lanceRatio = totalCards > 0 ? parseFloat(((lanceCards / totalCards) * 100).toFixed(1)) : 0;

  // ═══ 5. ATTACK METRICS ═══

  let defGoals = 0;
  let midGoals = 0;
  let fwdGoals = 0;
  const playerGoals: Record<string, number> = {};
  let totalGoalsScoredByTeam = 0;

  for (const m of rivalMatches) {
    const goals = events.filter(
      (e) =>
        e.match_id === m.id &&
        e.team_name.toLowerCase().trim() === cleanRivalName &&
        ["goal", "penalty_goal"].includes(e.event_type)
    );

    for (const g of goals) {
      totalGoalsScoredByTeam++;
      playerGoals[g.player_name] = (playerGoals[g.player_name] || 0) + 1;

      const pos = getPlayerPositionCategory(g.player_name, m.id);
      if (pos === "DF") defGoals++;
      else if (pos === "MF") midGoals++;
      else if (pos === "FW") fwdGoals++;
    }
  }

  const sortedScorers = Object.entries(playerGoals).sort((a, b) => b[1] - a[1]);
  const goalDependency = {
    top1:
      sortedScorers.length > 0
        ? {
            name: sortedScorers[0][0],
            goals: sortedScorers[0][1],
            percentage:
              totalGoalsScoredByTeam > 0
                ? parseFloat(((sortedScorers[0][1] / totalGoalsScoredByTeam) * 100).toFixed(1))
                : 0,
          }
        : null,
    top2:
      sortedScorers.length > 1
        ? {
            name: sortedScorers[1][0],
            goals: sortedScorers[1][1],
            percentage:
              totalGoalsScoredByTeam > 0
                ? parseFloat((((sortedScorers[0][1] + sortedScorers[1][1]) / totalGoalsScoredByTeam) * 100).toFixed(1))
                : 0,
          }
        : null,
  };

  const goalscorerDistribution = {
    defenders: defGoals,
    midfielders: midGoals,
    forwards: fwdGoals,
  };

  // ═══ GENERAR INFORME EJECUTIVO ═══

  const mainCoachName = staff?.coach || "Sin registrar";
  const intocablesNames = intocables.map((p) => p.name).slice(0, 3).join(", ");
  const topScorerName = goalDependency.top1?.name || "Nadie";
  const topScorerPercentage = goalDependency.top1?.percentage || 0;

  const executiveReport = `
# Informe de Scouting Rival: ${rivalName}
**Temporada:** ${season} | **Partidos analizados:** ${totalMatches}

## Resumen de Rendimiento
El rival ha disputado **${totalMatches} partidos** cosechando **${wins} victorias**, **${draws} empates** y **${losses} derrotas** (${points} puntos). Ha marcado **${goalsFor} goles** (${(goalsFor / (totalMatches || 1)).toFixed(1)} por partido) y encajado **${goalsAgainst}** (${(goalsAgainst / (totalMatches || 1)).toFixed(1)} por partido).
El entrenador principal registrado es **${mainCoachName}**.

## Análisis Táctico y Gestión de Plantilla
- **Rotación y Continuidad**: Presenta un índice de rotación (IRC) de **${irc} cambios** en el once inicial por jornada. El índice IJI de jerarquía es del **${iji}%**, lo que indica que ${iji > 75 ? "tienen un bloque muy definido y confían principalmente en los titulares habituales" : "realizan rotaciones regulares y tienen una plantilla muy repartida"}.
- **Jugadores Intocables**: Los jugadores que acumulan más carga de minutos son: ${intocablesNames || "ninguno destaca por encima del 80%"}.
- **Parejas Estables**:
  - Centrales habituales: ${stablePairs.centrales ? `${stablePairs.centrales.players.join(" y ")} (${stablePairs.centrales.percentage}% de coincidencia)` : "No se detecta pareja estable"}.
  - Pareja de mediocampo: ${stablePairs.pivotes ? `${stablePairs.pivotes.players.join(" y ")} (${stablePairs.pivotes.percentage}% de coincidencia)` : "No se detecta pareja estable"}.
  - Pareja de delantera: ${stablePairs.delanteros ? `${stablePairs.delanteros.players.join(" y ")} (${stablePairs.delanteros.percentage}% de coincidencia)` : "No se detecta pareja estable"}.

## Dinámica del Entrenador (Reacción)
- La **ventana media de reacción** del entrenador para su primer cambio se sitúa en el minuto **${reactionWindow}'**.
- Suele utilizar una media de **${benchUsage} cambios** de los disponibles por encuentro.
- Los revulsivos o suplentes habituales que entran desde el banquillo son: ${frequentSubs.map((s) => `${s.name} (${s.count} veces)`).join(", ") || "Ninguno destacado"}.

## Dinámicas de Partido
- **Tiempos de Juego**: El equipo pasa el **${timeLeading.winning}%** de los minutos ganando, el **${timeLeading.drawing}%** empatando y el **${timeLeading.losing}%** perdiendo.
- **Resiliencia e Impacto**: Tiene un índice de resiliencia del **${resilienceIndex}%** (puntos sumados tras encajar el primer gol). Ha conseguido **${comebacks} remontadas** en lo que va de temporada.
- **Minutos de Caos**: Los picos de mayor actividad física y de incidencias del partido se agrupan en el tramo de los **${chaosMinutes}**.

## Comportamiento y Disciplina
- El equipo recibe más tarjetas en la **${cardsSecondHalf > cardsFirstHalf ? "Segunda mitad" : "Primera mitad"}** (Primera Parte: ${cardsFirstHalf} | Segunda Parte: ${cardsSecondHalf}).
- **Perfil de Tarjetas**:
  - Ratio de Protestas: **${protestRatio}%** de las amonestaciones totales son por protestar al árbitro.
  - Conducta Violenta: **${violenceRatio}%** son catalogadas como violencia no vinculada al lance de juego.
  - Lances y Faltas Tácticas: **${lanceRatio}%** corresponden a lances de juego normales.

## Aspecto Ofensivo
- **Distribución del Gol**: Los goles del equipo se reparten en: Delanteros (${goalscorerDistribution.forwards}), Mediocampistas (${goalscorerDistribution.midfielders}), Defensas (${goalscorerDistribution.defenders}).
- **Dependencia**: Tienen una dependencia de gol del **${topScorerPercentage}%** en su máximo realizador (**${topScorerName}**).
`.trim();

  return {
    rivalName,
    season,
    matchesPlayed: totalMatches,
    wins,
    draws,
    losses,
    goalsFor,
    goalsAgainst,
    points,
    squad: {
      irc,
      rfo,
      iji,
      intocables,
      stablePairs,
    },
    coach: {
      reactionWindow,
      benchUsage,
      frequentSubs,
      staff,
    },
    dynamics: {
      goalClusters: {
        scored: scoredClusters,
        conceded: concededClusters,
      },
      resilienceIndex,
      comebacks,
      chaosMinutes,
      timeLeading,
    },
    discipline: {
      cardsFirstHalf,
      cardsSecondHalf,
      protestRatio,
      violenceRatio,
      lanceRatio,
    },
    attack: {
      goalscorerDistribution,
      goalDependency,
    },
    executiveReport,
  };
}
