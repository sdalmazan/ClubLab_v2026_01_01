import type { RfcylfSession } from "../../../scripts/rfcylf-browser";
import { resetRfcylfPage } from "../../../scripts/rfcylf-browser";
import type { CompetitionConfig } from "./types";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function getJornadaUrl(config: CompetitionConfig, jornada: number): string {
  return (
    "https://www.rfcylf.es/pnfg/NPcd/NFG_CmpJornada" +
    "?cod_primaria=1000120" +
    `&CodCompeticion=${config.competicion}` +
    `&CodGrupo=${config.grupo}` +
    `&CodTemporada=${config.temporada}` +
    `&CodJornada=${jornada}`
  );
}

export function getPdfUrl(codActa: string): string {
  return (
    "https://www.rfcylf.es/pnfg/NPcd/NFG_CmpPartido" +
    "?cod_primaria=1000120" +
    `&CodActa=${codActa}` +
    `&cod_acta=${codActa}` +
    "&NPcd_Pdf=1"
  );
}

export async function downloadJornadaHtml(
  session: RfcylfSession,
  config: CompetitionConfig,
  jornada: number
): Promise<string> {
  const jornadaUrl = getJornadaUrl(config, jornada);

  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      console.log(`Abriendo jornada ${jornada}. Intento ${attempt}/4...`);

      const response = await session.page.goto(jornadaUrl, {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });

      await session.page.waitForTimeout(2000);

      const html = await session.page.content();
      const bodyText = await session.page
        .locator("body")
        .innerText()
        .catch(() => "");

      console.log(
        `Jornada ${jornada}: status=${response?.status() ?? "sin respuesta"}, ` +
          `url=${session.page.url()}, html=${html.length}, texto=${bodyText.length}`
      );

      if (html && html.length > 0) {
        return html;
      }
    } catch (error: any) {
      console.error(
        `Error abriendo la jornada ${jornada} en el intento ${attempt}:`,
        error.message || error
      );
    }

    if (attempt < 4) {
      const waitMs = attempt * 10_000;
      console.log(`Esperando ${waitMs / 1000} segundos y reiniciando la página...`);
      await sleep(waitMs);
      await resetRfcylfPage(session);
    }
  }

  throw new Error(
    `No se pudo descargar la página para la jornada ${jornada} tras 4 intentos.`
  );
}

export async function downloadPdfToMemory(
  session: RfcylfSession,
  codActa: string,
  jornadaUrl: string
): Promise<Buffer> {
  const pdfUrl = getPdfUrl(codActa);

  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      console.log(`Descargando acta ${codActa}. Intento ${attempt}/4...`);

      const response = await session.context.request.get(pdfUrl, {
        headers: {
          Referer: jornadaUrl,
          Accept: "application/pdf,text/html;q=0.9,*/*;q=0.8",
          "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
        },
        timeout: 45_000,
        failOnStatusCode: false,
      });

      const contentType = response.headers()["content-type"] ?? "";
      const buffer = await response.body();

      console.log(
        `Acta ${codActa}: status=${response.status()}, tipo=${contentType}, bytes=${buffer.length}`
      );

      const isPdf =
        contentType.toLowerCase().includes("application/pdf") ||
        buffer.subarray(0, 4).toString() === "%PDF";

      if (response.ok() && isPdf && buffer.length > 1000) {
        return buffer;
      }

      console.log(
        `Respuesta inválida para el acta ${codActa} en el intento ${attempt}.`
      );
    } catch (error: any) {
      console.error(
        `Error descargando el acta ${codActa} en el intento ${attempt}:`,
        error.message || error
      );
    }

    if (attempt < 4) {
      const waitMs = attempt * 10_000;
      console.log(`Esperando ${waitMs / 1000} segundos...`);
      await sleep(waitMs);

      // Regresar a la home para reiniciar estado de la sesión
      await session.page.goto("https://www.rfcylf.es/", {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      }).catch(() => null);

      await session.page.waitForTimeout(2000);
    }
  }

  throw new Error(
    `No se pudo descargar un PDF válido para el acta ${codActa} tras 4 intentos.`
  );
}
