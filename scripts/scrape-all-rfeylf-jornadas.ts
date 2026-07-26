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

function cleanTeamName(raw: string): string {
  return raw
    .trim()
    .replace(/[\n\r\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  console.log("════════════════════════════════════════════════════════");
  console.log("  Scraper Completo de Jornadas 1 a 34 RFCYLF (2026/2027)");
  console.log("════════════════════════════════════════════════════════");

  const season = "2026/2027";
  const competition = "Tercera Federación - Grupo 8";
  const competitionCode = "24218932";
  const groupCode = "24218933";
  const seasonCode = "22";

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: "es-ES",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    extraHTTPHeaders: {
      "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
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

  // Visit home page to establish session
  console.log("Visitando portada RFCYLF para iniciar sesión...");
  await page.goto("https://www.rfcylf.es/", { waitUntil: "domcontentloaded" }).catch(() => null);
  await new Promise((r) => setTimeout(r, 2500));

  let totalMatchesExtracted = 0;
  const scrapedMatchesByJornada = new Map<number, any[]>();

  for (let j = 1; j <= 34; j++) {
    const url = `https://www.rfcylf.es/pnfg/NPcd/NFG_CmpJornada?cod_primaria=1000120&CodCompeticion=${competitionCode}&CodGrupo=${groupCode}&CodTemporada=${seasonCode}&CodJornada=${j}`;
    console.log(`\nDescargando Jornada ${j}...`);

    let extractedMatches: any[] = [];

    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
        await new Promise((r) => setTimeout(r, 1500));

        const html = await page.content();
        if (html && html.length >= 5000) {
          extractedMatches = await page.evaluate(() => {
            const matchesData: any[] = [];
            const tables = Array.from(document.querySelectorAll("table"));

            for (const table of tables) {
              const rows = Array.from(table.querySelectorAll("tr"));
              for (const tr of rows) {
                const rowText = tr.textContent || "";
                const actaLink = tr.querySelector("a[href*='CodActa']");
                const codActa = actaLink ? (actaLink.getAttribute("href") || "").match(/CodActa=(\d+)/i)?.[1] : null;

                const teamLinks = Array.from(tr.querySelectorAll("a")).filter((a) =>
                  (a.getAttribute("href") || "").includes("NFG_VisEquipo")
                );

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

            return matchesData;
          });

          if (extractedMatches.length > 0) {
            console.log(`  -> Éxito J${j}: ${extractedMatches.length} partidos extraídos.`);
            break;
          }
        }

        console.warn(`  [Intento ${attempt}] HTML corto (${html?.length || 0} bytes). Re-visitando portada...`);
        await page.goto("https://www.rfcylf.es/", { waitUntil: "domcontentloaded" }).catch(() => null);
        await new Promise((r) => setTimeout(r, 3000));
      } catch (err: any) {
        console.warn(`  [Intento ${attempt}] Error:`, err.message);
        await page.goto("https://www.rfcylf.es/", { waitUntil: "domcontentloaded" }).catch(() => null);
        await new Promise((r) => setTimeout(r, 3000));
      }
    }

    // Deduplicate in current matchday
    const uniqueMap = new Map<string, any>();
    for (const m of extractedMatches) {
      const h = cleanTeamName(m.home);
      const a = cleanTeamName(m.away);
      if (h && a && h !== a) {
        const key = `${h}___${a}`;
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, { ...m, home: h, away: a });
        }
      }
    }

    const uniqueList = Array.from(uniqueMap.values());
    scrapedMatchesByJornada.set(j, uniqueList);
    totalMatchesExtracted += uniqueList.length;

    // Small delay between matchdays to respect server rate limit
    await new Promise((r) => setTimeout(r, 1200));
  }

  console.log(`\n========================================`);
  console.log(`SCRAPING FINALIZADO: ${totalMatchesExtracted} partidos de 34 jornadas.`);
  console.log(`========================================\n`);

  if (totalMatchesExtracted > 0) {
    // Delete old 2026/2027 matches and insert scraped matches
    await statsAdmin.from("stat_matches").delete().eq("season", season);

    const rowsToInsert: any[] = [];
    for (let j = 1; j <= 34; j++) {
      const jMatches = scrapedMatchesByJornada.get(j) || [];
      for (const m of jMatches) {
        const homeTeam = m.home;
        const awayTeam = m.away;
        const isPlayed = m.homeScore !== null && m.awayScore !== null;
        const matchDate = parseSpanishDate(m.date);
        const isAlmazan = homeTeam.toLowerCase().includes("almazán") || homeTeam.toLowerCase().includes("almazan");

        let fedId = m.codActa;
        if (!fedId) {
          const hSlug = homeTeam.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);
          const aSlug = awayTeam.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);
          fedId = `2026_2027_J${j}_${hSlug}_${aSlug}`;
        }

        rowsToInsert.push({
          federation_id: fedId,
          competition,
          competition_code: competitionCode,
          group_code: groupCode,
          season,
          matchday: j,
          match_date: matchDate,
          venue: isAlmazan ? "Campo Municipal La Arboleda" : "Campo Pendiente de asignar",
          home_team: homeTeam,
          away_team: awayTeam,
          home_score: isPlayed ? m.homeScore : -1,
          away_score: isPlayed ? m.awayScore : -1,
          matchday_url: `https://www.rfcylf.es/pnfg/NPcd/NFG_CmpJornada?cod_primaria=1000120&CodCompeticion=${competitionCode}&CodGrupo=${groupCode}&CodTemporada=${seasonCode}&CodJornada=${j}`,
        });
      }
    }

    for (let i = 0; i < rowsToInsert.length; i += 50) {
      const chunk = rowsToInsert.slice(i, i + 50);
      const { error: insErr } = await statsAdmin.from("stat_matches").insert(chunk);
      if (insErr) console.error(`Error al insertar lote ${i}:`, insErr.message);
    }

    console.log(`Base de datos actualizada con ${rowsToInsert.length} partidos oficiales de RFCYLF.`);
  }

  await browser.close();
}

main().catch(console.error);
