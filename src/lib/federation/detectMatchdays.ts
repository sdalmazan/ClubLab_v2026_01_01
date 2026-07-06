import type { RfcylfSession } from "../../../scripts/rfcylf-browser";
import type { CompetitionConfig } from "./types";

export async function detectAvailableMatchdays(
  session: RfcylfSession,
  config: CompetitionConfig
): Promise<number[]> {
  const matchdays = new Set<number>();
  
  // Go to the first matchday URL to inspect the page DOM
  const targetUrl = `https://www.rfcylf.es/pnfg/NPcd/NFG_CmpJornada?cod_primaria=1000120&CodCompeticion=${config.competicion}&CodGrupo=${config.grupo}&CodTemporada=${config.temporada}&CodJornada=1`;
  
  console.log(`Detectando jornadas disponibles desde: ${targetUrl}`);
  
  try {
    await session.page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    
    // Esperar a que el DOM se asiente
    await session.page.waitForTimeout(2000);
    
    // Método 1: Buscar en los elementos <select> y sus <option>
    const selects = await session.page.locator("select").all();
    console.log(`Encontrados ${selects.length} elementos select en la página.`);
    
    for (const select of selects) {
      const name = (await select.getAttribute("name")) || "";
      const id = (await select.getAttribute("id")) || "";
      
      const isMatchdaySelect =
        name.toLowerCase().includes("jornada") ||
        id.toLowerCase().includes("jornada") ||
        name.includes("CodJornada") ||
        id.includes("CodJornada");
        
      const options = await select.locator("option").all();
      
      for (const option of options) {
        const text = (await option.innerText()) || "";
        const value = (await option.getAttribute("value")) || "";
        
        if (
          isMatchdaySelect ||
          text.toLowerCase().includes("jornada") ||
          text.toLowerCase().includes("jor.")
        ) {
          const numFromValue = parseInt(value, 10);
          const numFromText = parseInt(text.replace(/\D/g, ""), 10);
          
          if (!isNaN(numFromValue) && numFromValue >= 1 && numFromValue <= 60) {
            matchdays.add(numFromValue);
          } else if (!isNaN(numFromText) && numFromText >= 1 && numFromText <= 60) {
            matchdays.add(numFromText);
          }
        }
      }
    }
    
    // Método 2: Buscar en enlaces <a> que contengan CodJornada=
    if (matchdays.size === 0) {
      console.log("Método 1 (select) devolvió 0 jornadas. Probando Método 2 (enlaces)...");
      const links = await session.page.locator("a[href*='jornada'], a[href*='Jornada']").all();
      
      for (const link of links) {
        const href = (await link.getAttribute("href")) || "";
        const match = href.match(/CodJornada=(\d+)/i) || href.match(/jornada=(\d+)/i) || href.match(/Jornada=(\d+)/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num >= 1 && num <= 60) {
            matchdays.add(num);
          }
        }
      }
    }
    
  } catch (err: any) {
    console.error("Error detectando jornadas:", err.message);
  }
  
  const sortedMatchdays = Array.from(matchdays).sort((a, b) => a - b);
  console.log(`Detectadas ${sortedMatchdays.length} jornadas desde el selector.`);
  return sortedMatchdays;
}
