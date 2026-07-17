import { PDFParse } from "pdf-parse";

// ============================================================
// Parser de Actas PDF de la RFCYLF
// Fútbol 11 — Tercera Federación
// ============================================================

export interface ParsedPlayer {
  number: number;
  name: string;
  is_starter: boolean;
}

export interface ParsedSubstitution {
  in_number: number;
  in_name: string;
  out_number: number;
  out_name: string;
  minute: number;
  extra_time: number;
  team: "local" | "visitor";
}

export interface ParsedGoal {
  player_name: string;
  minute: number;
  extra_time: number;
  type: "normal" | "penalty" | "own_goal";
  team: "local" | "visitor";
  score_home_after: number;
  score_away_after: number;
}

export interface ParsedCard {
  player_name: string;
  minute: number;
  extra_time: number;
  type: "amarilla" | "roja" | "doble amarilla";
  team: "local" | "visitor";
  reason?: string | null;
  reason_type?: "protesta" | "violencia" | "lance";
}

export interface ParsedStaff {
  coach: string | null;
  assistant: string | null;
  physio: string | null;
  fitness_coach: string | null;
}

export interface ParsedMatchReport {
  jornada: number | null;
  date: string | null;
  local_team: string | null;
  visitor_team: string | null;
  campo: string | null;

  // Resultado final
  goals_local: number;
  goals_visitor: number;

  // Resultado al descanso (si está en el acta)
  goals_local_ht: number | null;
  goals_visitor_ht: number | null;

  // Jugadores
  local_players: ParsedPlayer[];
  visitor_players: ParsedPlayer[];

  // Eventos
  substitutions: ParsedSubstitution[];
  goals: ParsedGoal[];
  cards: ParsedCard[];

  // Cuerpo técnico
  local_staff: ParsedStaff | null;
  visitor_staff: ParsedStaff | null;

  incidents: string;
}

// ── Utilidades ──────────────────────────────────────────────

function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function normalizeLine(line: string): string {
  return line
    .replace(/\s+/g, " ")
    .replace(/(\d+)\s+(\d+)\./g, "$1$2.")
    .trim();
}

function parseMinute(raw: string): { minute: number; extra: number } {
  const withExtra = raw.match(/(\d+)\+(\d+)/);
  if (withExtra) {
    return { minute: parseInt(withExtra[1]), extra: parseInt(withExtra[2]) };
  }
  const plain = raw.match(/(\d+)/);
  return { minute: plain ? parseInt(plain[1]) : 0, extra: 0 };
}

function parseSpanishDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/(\d{2})[/-](\d{2})[/-](\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function detectCardReason(
  fullText: string,
  playerName: string,
  minute: number
): { reason: string | null; reason_type: "protesta" | "violencia" | "lance" } {
  const lines = fullText.split("\n");
  const nameParts = playerName.split(/[,\s]+/);
  const nameTokens = nameParts.map((p) => p.trim().toLowerCase()).filter((p) => p.length > 2);

  for (const line of lines) {
    const lineLower = line.toLowerCase();
    const hasMinute = lineLower.includes(String(minute)) || lineLower.includes(`${minute}'`);
    const hasName = nameTokens.some((token) => lineLower.includes(token));

    if (hasMinute && hasName) {
      let reason_type: "protesta" | "violencia" | "lance" = "lance";
      const protestKeywords = [
        "protestar",
        "protestas",
        "dirigirse a mí",
        "desconsideración",
        "observación",
        "reclamar",
        "protesto",
        "recriminar",
        "contestar",
      ];
      const violenceKeywords = [
        "golpear",
        "empujar",
        "insultar",
        "agredir",
        "conducta violenta",
        "escupir",
        "amenazar",
        "agresión",
        "puño",
        "patada",
        "violento",
        "pegar",
        "agredió",
        "golpeó",
      ];

      if (protestKeywords.some((k) => lineLower.includes(k))) {
        reason_type = "protesta";
      } else if (violenceKeywords.some((k) => lineLower.includes(k))) {
        reason_type = "violencia";
      }

      return {
        reason: line.trim(),
        reason_type,
      };
    }
  }

  return { reason: null, reason_type: "lance" };
}

// ── Parser principal ─────────────────────────────────────────

export async function parseMatchPdf(
  pdfBuffer: Buffer
): Promise<ParsedMatchReport> {
  const parser = new PDFParse({ data: pdfBuffer });
  const data = await parser.getText();
  await parser.destroy();
  const fullText = data.text;

  let text = fullText.replace(/(\d+)[ \t]+(\d+)\./g, "$1$2.");
  const lines: string[] = text
    .split("\n")
    .map((l: string) => normalizeLine(l))
    .filter((l: string) => l.length > 0);

  const report: ParsedMatchReport = {
    jornada: null,
    date: null,
    local_team: null,
    visitor_team: null,
    campo: null,
    goals_local: 0,
    goals_visitor: 0,
    goals_local_ht: null,
    goals_visitor_ht: null,
    local_players: [],
    visitor_players: [],
    substitutions: [],
    goals: [],
    cards: [],
    local_staff: null,
    visitor_staff: null,
    incidents: "",
  };

  // Cabecera
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!report.jornada) {
      const mJ = line.match(/JORNADA[:\s]+(\d+)/i) || line.match(/Jornada\s+(\d+)/i);
      if (mJ) report.jornada = parseInt(mJ[1]);
    }
    if (!report.date && line.includes("Fecha:")) {
      report.date = parseSpanishDate(line);
    }
    if (!report.campo) {
      const mE =
        line.match(/ESTADIO:\s*([^\n\t]+)/i) ||
        line.match(/Campo:\s*([^\n\t]+)/i) ||
        line.match(/CAMPO:\s*([^\n\t]+)/i);
      if (mE) report.campo = cleanText(mE[1]);
    }
    if (!report.local_team && line.includes("Fecha:") && line.includes("Temporada")) {
      if (lines[i + 1]) report.local_team = cleanText(lines[i + 1]);
    }
    if (!report.visitor_team && line.includes("Ciudad:") && lines[i + 1]) {
      report.visitor_team = cleanText(lines[i + 1]);
    }
  }

  // Marcadores
  const scoreMatches = Array.from(text.matchAll(/\(\s*(\d+)\s*\)/g)) as RegExpMatchArray[];
  if (scoreMatches.length >= 4) {
    report.goals_local_ht = parseInt(scoreMatches[0][1]);
    report.goals_visitor_ht = parseInt(scoreMatches[1][1]);
    report.goals_local = parseInt(scoreMatches[2][1]);
    report.goals_visitor = parseInt(scoreMatches[3][1]);
  } else if (scoreMatches.length >= 2) {
    report.goals_local = parseInt(scoreMatches[0][1]);
    report.goals_visitor = parseInt(scoreMatches[1][1]);
  }

  // Si no se detectaron marcadores parentizados (formato RFEF nacional sin paréntesis, ej: "3 - 0")
  if (report.goals_local === 0 && report.goals_visitor === 0) {
    const arbitrosIdx = lines.findIndex((l) => l.toUpperCase().includes("ÁRBITROS"));
    if (arbitrosIdx !== -1) {
      // Buscar en las 3 líneas anteriores un marcador tipo "X - Y"
      for (let offset = 1; offset <= 3; offset++) {
        const prevLine = lines[arbitrosIdx - offset];
        if (prevLine) {
          const scoreMatch = prevLine.match(/^(\d+)\s*-\s*(\d+)$/);
          if (scoreMatch) {
            report.goals_local = parseInt(scoreMatch[1]);
            report.goals_visitor = parseInt(scoreMatch[2]);
            break;
          }
        }
      }
    }
  }

  const visitorIdx = lines.findIndex(
    (l: string, idx: number) => idx > 10 && report.visitor_team && l === report.visitor_team
  );

  const localLines = visitorIdx !== -1 ? lines.slice(0, visitorIdx) : lines;
  const visitorLines = visitorIdx !== -1 ? lines.slice(visitorIdx) : [];

  // Alineaciones y cuerpo técnico
  const playerRegex = /^(\d{1,2})[.\s]\s*(.+)$/;

  function parseTeamBlock(
    teamLines: string[],
    isLocal: boolean
  ): {
    players: ParsedPlayer[];
    substitutions: ParsedSubstitution[];
    cards: ParsedCard[];
    staff: ParsedStaff;
  } {
    const teamType = isLocal ? "local" : "visitor";
    const players: ParsedPlayer[] = [];
    const subs: ParsedSubstitution[] = [];
    const cards: ParsedCard[] = [];
    const staff: ParsedStaff = {
      coach: null,
      assistant: null,
      physio: null,
      fitness_coach: null,
    };

    let inPlayersSection = true;
    let inStaffSection = false;

    for (let i = 0; i < teamLines.length; i++) {
      const line = teamLines[i];

      if (line.includes("CUERPO TÉCNICO")) {
        inPlayersSection = false;
        inStaffSection = true;
        continue;
      }

      if (
        line.includes("TARJETAS") ||
        line.includes("GOLES") ||
        line.includes("SUSTITUCIONES") ||
        line.includes("TITULARES") ||
        line.includes("SUPLENTES") ||
        line.includes("ESTADIO")
      ) {
        inPlayersSection = false;
        inStaffSection = false;
      }

      if (inPlayersSection) {
        const m = line.match(playerRegex);
        if (m) {
          const num = parseInt(m[1]);
          const name = cleanText(m[2]);
          players.push({
            number: num,
            name,
            is_starter: players.length < 11,
          });
        }
      }

      if (inStaffSection) {
        const normalizedLine = line.toUpperCase().trim();
        let roleField: keyof ParsedStaff | null = null;

        if (normalizedLine === "ENTRENADOR" || normalizedLine === "ENTRENADOR PRINCIPAL") {
          roleField = "coach";
        } else if (
          normalizedLine === "2º ENTRENADOR" ||
          normalizedLine === "2O ENTRENADOR" ||
          normalizedLine === "SEGUNDO ENTRENADOR"
        ) {
          roleField = "assistant";
        } else if (normalizedLine === "PREPARADOR FÍSICO" || normalizedLine === "PREPARADOR FISICO") {
          roleField = "fitness_coach";
        } else if (
          normalizedLine === "ATS O FISIOTERAPEUTA" ||
          normalizedLine === "ATS" ||
          normalizedLine === "FISIOTERAPEUTA" ||
          normalizedLine.includes("FISIO")
        ) {
          roleField = "physio";
        }

        if (roleField && teamLines[i + 1]) {
          const name = cleanText(teamLines[i + 1]);
          const isNotName =
            name.includes("CUERPO TÉCNICO") ||
            name.includes("TARJETAS") ||
            name.includes("GOLES") ||
            name.includes("SUSTITUCIONES") ||
            name.includes("TITULARES") ||
            name.includes("SUPLENTES") ||
            name.includes("ESTADIO") ||
            name.toUpperCase() === "DELEGADO CAMPO" ||
            name.toUpperCase() === "DELEGADO EQUIPO" ||
            name.toUpperCase() === "ENTRENADOR" ||
            name.toUpperCase() === "2º ENTRENADOR" ||
            name.toUpperCase() === "PREPARADOR FÍSICO" ||
            name.toUpperCase() === "ATS O FISIOTERAPEUTA";

          if (!isNotName) {
            staff[roleField] = name;
            i++;
          }
        }
      }

      const outMatch = line.match(
        /^(\d+)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ\s,.'"-]+?)\s+\((\d+(?:\+\d+)?)'?\)$/
      );
      if (outMatch) {
        const outNum = parseInt(outMatch[1]);
        const outName = cleanText(outMatch[2]);
        const { minute, extra } = parseMinute(outMatch[3]);

        const prevLine = teamLines[i - 1];
        if (prevLine) {
          const inMatch = prevLine.match(/^(\d+)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ\s,.'"-]+)$/);
          if (inMatch) {
            subs.push({
              in_number: parseInt(inMatch[1]),
              in_name: cleanText(inMatch[2]),
              out_number: outNum,
              out_name: outName,
              minute,
              extra_time: extra,
              team: teamType,
            });
          }
        }
      }
    }

    const cardsStartIdx = teamLines.findIndex((l) => l.includes("TARJETAS"));
    if (cardsStartIdx !== -1) {
      for (let i = cardsStartIdx + 1; i < teamLines.length; i++) {
        const line = teamLines[i];
        if (
          line.includes("TITULARES") ||
          line.includes("SUPLENTES") ||
          line.includes("SUSTITUCIONES") ||
          line.includes("CUERPO") ||
          line.includes("GOLES") ||
          line.includes("ESTADIO")
        ) break;

        const cardMatch = line.match(
          /^([A-ZÁÉÍÓÚÑa-záéíóúñ\s,.'"-]+?)\s+\((\d+(?:\+\d+)?)'?\)$/
        );
        if (cardMatch) {
          const name = cleanText(cardMatch[1]);
          const { minute, extra } = parseMinute(cardMatch[2]);

          let type: ParsedCard["type"] = "amarilla";
          if (line.toLowerCase().includes("roja directa") || line.toLowerCase().includes("roja")) {
            type = "roja";
          } else if (line.toLowerCase().includes("doble")) {
            type = "doble amarilla";
          }

          cards.push({
            player_name: name,
            minute,
            extra_time: extra,
            type,
            team: teamType,
          });
        }
      }
    }

    return { players, substitutions: subs, cards, staff };
  }

  const localParsed = parseTeamBlock(localLines, true);
  const visitorParsed = parseTeamBlock(visitorLines, false);

  report.local_players = localParsed.players;
  report.visitor_players = visitorParsed.players;
  report.substitutions = [...localParsed.substitutions, ...visitorParsed.substitutions];
  report.cards = [...localParsed.cards, ...visitorParsed.cards];
  report.local_staff = localParsed.staff;
  report.visitor_staff = visitorParsed.staff;

  for (const card of report.cards) {
    const { reason, reason_type } = detectCardReason(fullText, card.player_name, card.minute);
    card.reason = reason;
    card.reason_type = reason_type;
  }

  // Goles
  let currentHomeScore = 0;
  let currentAwayScore = 0;

  const goalsStartIdx = lines.findIndex((l: string) => l.includes("GOLES"));
  if (goalsStartIdx !== -1) {
    for (let i = goalsStartIdx + 1; i < lines.length; i++) {
      const line = lines[i];

      if (
        line.includes("ESTADIO:") ||
        line.includes("Ciudad:") ||
        line.includes("TARJETAS") ||
        line.includes("TITULARES") ||
        line.includes("OBSERVACIONES")
      ) break;

      const goalMatch = line.match(
        /^(\d+)\s*-\s*(\d+)\s+(.+?)\s+\((\d+)(?:\+(\d+))?'?.*?\)$/
      );
      if (goalMatch) {
        const scoreHome = parseInt(goalMatch[1]);
        const scoreAway = parseInt(goalMatch[2]);
        const name = cleanText(goalMatch[3]);
        const minute = parseInt(goalMatch[4]);
        const extra = goalMatch[5] ? parseInt(goalMatch[5]) : 0;

        const lowerLine = line.toLowerCase();
        let type: ParsedGoal["type"] = "normal";
        if (
          lowerLine.includes("(p.p.)") ||
          lowerLine.includes("propia") ||
          lowerLine.includes("en propia") ||
          lowerLine.includes("autogol") ||
          /\(\d+.*?p\.p\.\)/.test(lowerLine)
        ) {
          type = "own_goal";
        } else if (
          lowerLine.includes("penalt") ||
          lowerLine.includes("(penalti)") ||
          lowerLine.includes("(p.)") ||
          /\(\d+.*?p\.\)/.test(lowerLine)
        ) {
          type = "penalty";
        }

        let team: "local" | "visitor";
        if (scoreHome > currentHomeScore) {
          team = "local";
        } else if (scoreAway > currentAwayScore) {
          team = "visitor";
        } else {
          const surname = name.split(",")[0].trim().toLowerCase();
          team = report.visitor_players.some((p) =>
            p.name.toLowerCase().includes(surname)
          )
            ? "visitor"
            : "local";
        }

        currentHomeScore = scoreHome;
        currentAwayScore = scoreAway;

        report.goals.push({
          player_name: name,
          minute,
          extra_time: extra,
          type,
          team,
          score_home_after: scoreHome,
          score_away_after: scoreAway,
        });
      }
    }
  }

  if (fullText.includes("3.- LESIONES")) {
    try {
      const injuriesSection = fullText.split("3.- LESIONES")[1].split("4.- PÚBLICO")[0];
      report.incidents = cleanText(injuriesSection);
    } catch (_) {
      // no incidents
    }
  }

  return report;
}
