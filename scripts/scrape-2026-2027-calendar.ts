import { config } from "dotenv";
import path from "path";
config({ path: path.resolve(process.cwd(), ".env.local") });

import { chromium } from "playwright";
import { statsAdmin } from "../src/lib/supabase/stats-admin";

function parseSpanishDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/(\d{2})[/-](\d{2})[/-](\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

// Calculate default Sunday date for a matchday index (1-based) given Jornada 1 base date 2026-09-06
function getSundayForMatchday(jornada: number): string {
  const baseDate = new Date("2026-09-06T12:00:00Z");
  baseDate.setDate(baseDate.getDate() + (jornada - 1) * 7);
  return baseDate.toISOString().split("T")[0];
}

function cleanTeamName(raw: string): string {
  return raw
    .trim()
    .replace(/[\n\r\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  console.log("════════════════════════════════════════════════════════");
  console.log("  Importador de Calendario 2026/2027 - Tercera RFEF G8");
  console.log("════════════════════════════════════════════════════════");

  const season = "2026/2027";
  const competition = "Tercera Federación - Grupo 8";
  const competitionCode = "24218932";
  const groupCode = "24218933";
  const seasonCode = "22";

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: "es-ES",
    extraHTTPHeaders: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

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

  // Warmup session
  await page.goto("https://www.rfcylf.es/", { waitUntil: "domcontentloaded" }).catch(() => null);
  await new Promise((r) => setTimeout(r, 2000));

  let totalMatchesInserted = 0;
  let totalMatchesUpdated = 0;

  for (let j = 1; j <= 34; j++) {
    const url = `https://www.rfcylf.es/pnfg/NPcd/NFG_CmpJornada?cod_primaria=1000120&CodCompeticion=${competitionCode}&CodGrupo=${groupCode}&CodTemporada=${seasonCode}&CodJornada=${j}`;
    console.log(`\n----------------------------------------`);
    console.log(`Descargando Jornada ${j}...`);

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      await new Promise((r) => setTimeout(r, 1500));

      const html = await page.content();
      if (!html || html.length < 5000) {
        console.warn(`⚠ Jornada ${j} demasiado corta o vacía (${html?.length}b). Usando fechas por defecto.`);
      }

      // Extract match rows from page
      const extractedMatches = await page.evaluate(() => {
        const matchesData: any[] = [];
        const tables = Array.from(document.querySelectorAll("table"));
        
        for (const table of tables) {
          const rows = Array.from(table.querySelectorAll("tr"));
          for (const tr of rows) {
            const cells = Array.from(tr.querySelectorAll("td"));
            if (cells.length >= 3) {
              const rowText = tr.textContent || "";
              const actaLink = tr.querySelector("a[href*='CodActa']");
              const codActa = actaLink ? (actaLink.getAttribute("href") || "").match(/CodActa=(\d+)/i)?.[1] : null;

              const teamLinks = Array.from(tr.querySelectorAll("a")).filter(a => (a.getAttribute("href") || "").includes("NFG_VisEquipo"));
              
              if (teamLinks.length >= 2) {
                const home = teamLinks[0].textContent?.trim() || "";
                const away = teamLinks[1].textContent?.trim() || "";
                const dateMatch = rowText.match(/(\d{2}[/-]\d{2}[/-]\d{4})/);
                const scoreMatch = rowText.match(/(\d+)\s*[-–]\s*(\d+)/);
                
                if (home && away) {
                  matchesData.push({
                    home,
                    away,
                    date: dateMatch ? dateMatch[1] : null,
                    homeScore: scoreMatch ? parseInt(scoreMatch[1], 10) : null,
                    awayScore: scoreMatch ? parseInt(scoreMatch[2], 10) : null,
                    codActa: codActa || null,
                  });
                }
              }
            }
          }
        }

        return matchesData;
      });

      console.log(`Jornada ${j}: ${extractedMatches.length} partidos extraídos.`);

      // Deduplicate matches in current jornada
      const uniqueMatchesMap = new Map<string, any>();
      for (const m of extractedMatches) {
        const h = cleanTeamName(m.home);
        const a = cleanTeamName(m.away);
        if (h && a && h !== a) {
          const key = `${h}___${a}`;
          if (!uniqueMatchesMap.has(key)) {
            uniqueMatchesMap.set(key, { ...m, home: h, away: a });
          }
        }
      }

      const matchesToProcess = Array.from(uniqueMatchesMap.values());
      console.log(`Jornada ${j}: ${matchesToProcess.length} partidos únicos a procesar.`);

      for (let idx = 0; idx < matchesToProcess.length; idx++) {
        const m = matchesToProcess[idx];
        const homeTeam = m.home;
        const awayTeam = m.away;

        const isPlayed = m.homeScore !== null && m.awayScore !== null;
        let matchDate = parseSpanishDate(m.date);
        
        if (!matchDate) {
          matchDate = getSundayForMatchday(j);
        }

        const isAlmazan = homeTeam.toLowerCase().includes("almazán") || awayTeam.toLowerCase().includes("almazan");

        let fedId = m.codActa;
        if (!fedId) {
          const hSlug = homeTeam.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);
          const aSlug = awayTeam.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);
          fedId = `2026_2027_J${j}_${hSlug}_${aSlug}`;
        }

        const matchRow = {
          federation_id: fedId,
          competition,
          competition_code: competitionCode,
          group_code: groupCode,
          season,
          matchday: j,
          match_date: matchDate,
          venue: isAlmazan ? "Campo Municipal La Arboleda" : "Campo por definir",
          home_team: homeTeam,
          away_team: awayTeam,
          home_score: isPlayed ? m.homeScore : null,
          away_score: isPlayed ? m.awayScore : null,
          status: isPlayed ? "finished" : "scheduled",
          matchday_url: url,
        };

        const { data: existing } = await statsAdmin
          .from("stat_matches")
          .select("id")
          .eq("season", season)
          .eq("competition", competition)
          .eq("matchday", j)
          .eq("home_team", homeTeam)
          .eq("away_team", awayTeam)
          .maybeSingle();

        if (existing) {
          await statsAdmin.from("stat_matches").update(matchRow).eq("id", existing.id);
          totalMatchesUpdated++;
        } else {
          await statsAdmin.from("stat_matches").insert(matchRow);
          totalMatchesInserted++;
        }
      }

    } catch (err: any) {
      console.error(`Error en jornada ${j}:`, err.message);
    }

    await new Promise((r) => setTimeout(r, 800));
  }

  console.log(`\n========================================`);
  console.log(`RESUMEN DE IMPORTACIÓN DE TEMPORADA 2026/2027:`);
  console.log(`- Partidos insertados: ${totalMatchesInserted}`);
  console.log(`- Partidos actualizados: ${totalMatchesUpdated}`);
  console.log(`========================================\n`);

  await browser.close();
}

main().catch(console.error);
