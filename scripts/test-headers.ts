import { config } from "dotenv";
import path from "path";
config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const { createRfcylfHttpSession } = await import("../src/lib/federation/rfcylf-http");

  console.log("Iniciando sesión...");
  const session = await createRfcylfHttpSession();

  const url = "https://www.rfcylf.es/pnfg/NPcd/NFG_CmpPartido?cod_primaria=1000120&CodActa=26086870&cod_acta=26086870&NPcd_Pdf=1";
  console.log(`Descargando de: ${url}`);

  const BASE_HEADERS: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
    "Cache-Control": "max-age=0",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
  };

  const reqHeaders: Record<string, string> = {
    ...BASE_HEADERS,
    Referer: "https://www.rfcylf.es/pnfg/NPcd/NFG_CmpJornada?cod_primaria=1000120&CodCompeticion=22911126&CodGrupo=22911127&CodTemporada=21&CodJornada=34",
    Cookie: session.cookies.join("; "),
  };

  console.log("Headers enviados:", reqHeaders);

  const res = await fetch(url, {
    headers: reqHeaders,
    redirect: "manual",
  });

  console.log(`Status: ${res.status}`);
  console.log("Headers recibidos:");
  res.headers.forEach((value, key) => {
    console.log(`  ${key}: ${value}`);
  });

  const ab = await res.arrayBuffer();
  console.log(`Bytes descargados: ${ab.byteLength}`);
  if (ab.byteLength > 0) {
    const start = Buffer.from(ab).subarray(0, 100).toString();
    console.log(`Inicio del contenido: ${start}`);
  }
}

main().catch(console.error);
