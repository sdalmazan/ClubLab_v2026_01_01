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

  incidents: string;
}

// ── Utilidades ──────────────────────────────────────────────

function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function normalizeLine(line: string): string {
  return line
    .replace(/\s+/g, " ")
    .replace(/(\d+)\s+(\d+)\./g, "$1$2.") // fix broken "1 9." → "19."
    .trim();
}

/**
 * Parsea minutos con posible tiempo añadido.
 * Ejemplos: "45'" → {minute:45, extra:0}, "90+3'" → {minute:90, extra:3}
 */
function parseMinute(raw: string): { minute: number; extra: number } {
  const withExtra = raw.match(/(\d+)\+(\d+)/);
  if (withExtra) {
    return { minute: parseInt(withExtra[1]), extra: parseInt(withExtra[2]) };
  }
  const plain = raw.match(/(\d+)/);
  return { minute: plain ? parseInt(plain[1]) : 0, extra: 0 };
}

/**
 * Parsea fecha en formato DD/MM/YYYY o DD-MM-YYYY a ISO YYYY-MM-DD.
 */
function parseSpanishDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/(\d{2})[/-](\d{2})[/-](\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

// ── Parser principal ─────────────────────────────────────────

export async function parseMatchPdf(
  pdfBuffer: Buffer
): Promise<ParsedMatchReport> {
  const parser = new PDFParse({ data: pdfBuffer });
  const data = await parser.getText();
  await parser.destroy();
  const fullText = data.text;

  // Pre-procesado: eliminar espacios extra en números partidos
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
    incidents: "",
  };

  // ── 1. Cabecera ──────────────────────────────────────────
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Jornada
    if (!report.jornada) {
      const mJ = line.match(/JORNADA[:\s]+(\d+)/i) || line.match(/Jornada\s+(\d+)/i);
      if (mJ) report.jornada = parseInt(mJ[1]);
    }

    // Fecha
    if (!report.date && line.includes("Fecha:")) {
      report.date = parseSpanishDate(line);
    }
    if (!report.date && line.includes("celebrado el")) {
      const m = line.match(/celebrado el\s+([^\n\t,]+)/i);
      if (m) report.date = cleanText(m[1]);
    }

    // Campo / estadio
    if (!report.campo) {
      const mE =
        line.match(/ESTADIO:\s*([^\n\t]+)/i) ||
        line.match(/Campo:\s*([^\n\t]+)/i) ||
        line.match(/CAMPO:\s*([^\n\t]+)/i);
      if (mE) report.campo = cleanText(mE[1]);
    }

    // Equipo local: línea siguiente a "Fecha: ... Temporada ..."
    if (!report.local_team && line.includes("Fecha:") && line.includes("Temporada")) {
      if (lines[i + 1]) report.local_team = cleanText(lines[i + 1]);
    }

    // Equipo visitante: línea siguiente a "Ciudad:"
    if (!report.visitor_team && line.includes("Ciudad:") && lines[i + 1]) {
      report.visitor_team = cleanText(lines[i + 1]);
    }

    // Fallback: "Clubes: EQUIPO A, EQUIPO B"
    if (!report.local_team && line.startsWith("Clubes:")) {
      const parts = line.replace("Clubes:", "").split(",");
      report.local_team = cleanText(parts[0]);
      if (parts[1]) report.visitor_team = cleanText(parts[1]);
    }
  }

  // ── 2. Marcadores ────────────────────────────────────────

  // Formato habitual: "(0) (1)" para HT, "(1) (2)" para FT (4 grupos de paréntesis)
  const scoreMatches = Array.from(text.matchAll(/\(\s*(\d+)\s*\)/g)) as RegExpMatchArray[];
  if (scoreMatches.length >= 4) {
    report.goals_local_ht  = parseInt(scoreMatches[0][1]);
    report.goals_visitor_ht = parseInt(scoreMatches[1][1]);
    report.goals_local     = parseInt(scoreMatches[2][1]);
    report.goals_visitor   = parseInt(scoreMatches[3][1]);
  } else if (scoreMatches.length >= 2) {
    report.goals_local   = parseInt(scoreMatches[0][1]);
    report.goals_visitor = parseInt(scoreMatches[1][1]);
  } else {
    // Fallback: busca "X - Y" aislado
    for (let i = 10; i < lines.length; i++) {
      if (/^\d+\s*-\s*\d+$/.test(lines[i])) {
        const parts = lines[i].split("-").map((p: string) => parseInt(p.trim()));
        report.goals_local   = parts[0];
        report.goals_visitor = parts[1];
        break;
      }
    }
  }

  // ── 3. Separar bloques local / visitante ────────────────

  const visitorIdx = lines.findIndex(
    (l: string, idx: number) => idx > 10 && report.visitor_team && l === report.visitor_team
  );

  const localLines   = visitorIdx !== -1 ? lines.slice(0, visitorIdx) : lines;
  const visitorLines = visitorIdx !== -1 ? lines.slice(visitorIdx) : [];

  // ── 4. Parsear alineaciones ──────────────────────────────
  const playerRegex = /^(\d{1,2})[.\s]\s*(.+)$/;

  function parseTeamBlock(
    teamLines: string[],
    isLocal: boolean
  ): { players: ParsedPlayer[]; substitutions: ParsedSubstitution[]; cards: ParsedCard[] } {
    const teamType = isLocal ? "local" : "visitor";
    const players: ParsedPlayer[] = [];
    const subs: ParsedSubstitution[] = [];
    const cards: ParsedCard[] = [];

    let inPlayersSection = true;

    for (let i = 0; i < teamLines.length; i++) {
      const line = teamLines[i];

      if (
        line.includes("CUERPO TÉCNICO") ||
        line.includes("TARJETAS") ||
        line.includes("GOLES") ||
        line.includes("SUSTITUCIONES")
      ) {
        inPlayersSection = false;
      }

      // Jugadores (nº. Nombre Apellido)
      if (inPlayersSection) {
        const m = line.match(playerRegex);
        if (m) {
          const num  = parseInt(m[1]);
          const name = cleanText(m[2]);
          // Primeros 11 son titulares
          players.push({ number: num, name, is_starter: players.length < 11 });
        }
      }

      // Sustituciones: buscamos el patrón "Nº NOMBRE APELLIDO (MIN')"
      // El jugador que sale tiene minuto, el que entra está en la línea anterior
      const outMatch = line.match(
        /^(\d+)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ\s,.'"-]+?)\s+\((\d+(?:\+\d+)?)'?\)$/
      );
      if (outMatch) {
        const outNum  = parseInt(outMatch[1]);
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

    // Tarjetas
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
          cards.push({ player_name: name, minute, extra_time: extra, type, team: teamType });
        }
      }
    }

    return { players, substitutions: subs, cards };
  }

  const localParsed   = parseTeamBlock(localLines, true);
  const visitorParsed = parseTeamBlock(visitorLines, false);

  report.local_players   = localParsed.players;
  report.visitor_players = visitorParsed.players;
  report.substitutions   = [...localParsed.substitutions, ...visitorParsed.substitutions];
  report.cards           = [...localParsed.cards, ...visitorParsed.cards];

  // ── 5. Goles (lista global con marcador acumulado) ────────

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

      // Formato: "1 - 0 APELLIDO, Nombre (MIN')"
      const goalMatch = line.match(
        /^(\d+)\s*-\s*(\d+)\s+(.+?)\s+\((\d+(?:\+\d+)?)'?\)$/
      );
      if (goalMatch) {
        const scoreHome = parseInt(goalMatch[1]);
        const scoreAway = parseInt(goalMatch[2]);
        const name      = cleanText(goalMatch[3]);
        const { minute, extra } = parseMinute(goalMatch[4]);

        let type: ParsedGoal["type"] = "normal";
        if (line.toLowerCase().includes("penalt")) type = "penalty";
        else if (line.toLowerCase().includes("propia") || line.toLowerCase().includes("en propia")) {
          type = "own_goal";
        }

        // Determinar equipo: si el marcador local sube → local
        let team: "local" | "visitor";
        if (scoreHome > currentHomeScore) {
          team = "local";
        } else if (scoreAway > currentAwayScore) {
          team = "visitor";
        } else {
          // Fallback por nombre del jugador
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

  // ── 6. Incidencias ───────────────────────────────────────
  if (fullText.includes("3.- LESIONES")) {
    try {
      const injuriesSection = fullText.split("3.- LESIONES")[1].split("4.- PÚBLICO")[0];
      report.incidents = cleanText(injuriesSection);
    } catch (_) {
      // no incidents section
    }
  }

  return report;
}
