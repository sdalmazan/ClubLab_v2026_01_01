// ============================================================
// rfcylf-http.ts — Cliente HTTP para rfcylf.es
// ============================================================
// Enfoque HTTP puro (sin Playwright/browser):
//  1. Visitar la home para obtener JSESSIONID vía Set-Cookie
//  2. Enviar JSESSIONID + cookie_aceptada=1 en todas las peticiones
//  3. Seguir redirects manualmente capturando cookies en cada salto
//
// Este enfoque fue el que funcionó en el proyecto v1 sin ser bloqueado.
// El portal rfcylf.es no requiere JavaScript para servir el HTML ni los PDFs.
// ============================================================

const RFCYLF_HOME = "https://www.rfcylf.es/";

const BASE_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
};

// ── Gestión de cookies ───────────────────────────────────────

function parseCookies(raw: string[]): string[] {
  return raw
    .filter(Boolean)
    .map((sc) => sc.split(";")[0].trim())
    .filter(Boolean);
}

function mergeCookies(existing: string[], incoming: string[]): string[] {
  const jar = new Map<string, string>();
  for (const c of existing) {
    const [name] = c.split("=");
    jar.set(name.trim(), c);
  }
  for (const c of incoming) {
    const [name] = c.split("=");
    jar.set(name.trim(), c);
  }
  return Array.from(jar.values());
}

// ── Fetch con manejo de redirects + cookies ──────────────────

export type FetchResult = {
  status: number;
  cookies: string[];
  text: () => Promise<string>;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

/**
 * Realiza un fetch siguiendo redirects manualmente y gestionando cookies.
 * Necesario porque rfcylf.es usa redirects con Set-Cookie.
 */
async function fetchWithCookies(
  initialUrl: string,
  cookies: string[],
  extraHeaders: Record<string, string> = {}
): Promise<FetchResult> {
  let url = initialUrl;
  let currentCookies = [...cookies];
  let lastRes: Response | null = null;

  // Hasta 6 saltos de redirect
  for (let hop = 0; hop < 6; hop++) {
    const reqHeaders: Record<string, string> = {
      ...BASE_HEADERS,
      ...extraHeaders,
    };

    if (currentCookies.length > 0) {
      reqHeaders["Cookie"] = currentCookies.join("; ");
    }

    const res = await fetch(url, {
      headers: reqHeaders,
      redirect: "manual",
    });

    lastRes = res;

    // Capturar cookies de Set-Cookie
    let setCookieHeaders: string[] = [];
    if (typeof (res.headers as any).getSetCookie === "function") {
      setCookieHeaders = (res.headers as any).getSetCookie();
    } else {
      const raw = res.headers.get("set-cookie");
      if (raw) setCookieHeaders = [raw];
    }

    if (setCookieHeaders.length > 0) {
      currentCookies = mergeCookies(currentCookies, parseCookies(setCookieHeaders));
    }

    // Seguir redirect
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (location) {
        url = location.startsWith("/")
          ? new URL(location, new URL(url).origin).toString()
          : location;
        continue;
      }
    }

    break;
  }

  if (!lastRes) throw new Error("fetchWithCookies: sin respuesta");

  return {
    status: lastRes.status,
    cookies: currentCookies,
    text: () => lastRes!.text(),
    arrayBuffer: () => lastRes!.arrayBuffer(),
  };
}

// ── Sesión RFCYLF ────────────────────────────────────────────

export type RfcylfHttpSession = {
  cookies: string[];
};

/**
 * Establece una sesión HTTP con rfcylf.es.
 * Visita la home para obtener el JSESSIONID y establece cookie_aceptada=1.
 */
export async function createRfcylfHttpSession(): Promise<RfcylfHttpSession> {
  console.log("  Estableciendo sesión HTTP con rfcylf.es...");

  // Siempre empezamos con cookie_aceptada=1 (bypass del banner de cookies)
  const initialCookies = ["cookie_aceptada=1"];

  const res = await fetchWithCookies(RFCYLF_HOME, initialCookies);

  console.log(
    `  Sesión establecida. Status: ${res.status}. Cookies: [${res.cookies.join(", ")}]`
  );

  return { cookies: res.cookies };
}

// ── Descarga de HTML de jornada ──────────────────────────────

export function getJornadaUrl(
  competicion: string,
  grupo: string,
  temporada: string,
  jornada: number
): string {
  return (
    "https://www.rfcylf.es/pnfg/NPcd/NFG_CmpJornada" +
    "?cod_primaria=1000120" +
    `&CodCompeticion=${competicion}` +
    `&CodGrupo=${grupo}` +
    `&CodTemporada=${temporada}` +
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

/**
 * Descarga el HTML de una página de jornada.
 * Reintenta hasta 3 veces renovando sesión si falla.
 */
export async function downloadJornadaHtml(
  session: RfcylfHttpSession,
  competicion: string,
  grupo: string,
  temporada: string,
  jornada: number
): Promise<{ html: string; session: RfcylfHttpSession }> {
  const url = getJornadaUrl(competicion, grupo, temporada, jornada);

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`  Jornada ${jornada}: intento ${attempt}/3...`);

      const res = await fetchWithCookies(url, session.cookies, {
        Referer: RFCYLF_HOME,
      });

      // Actualizar cookies de sesión con las que lleguen en la respuesta
      const updatedSession: RfcylfHttpSession = { cookies: res.cookies };
      const html = await res.text();

      console.log(
        `  Jornada ${jornada}: status=${res.status}, html=${html.length}b`
      );

      if (html.length > 500) {
        return { html, session: updatedSession };
      }

      console.log(`  Respuesta demasiado corta (${html.length}b). Reintentando...`);
    } catch (err: any) {
      console.error(`  Error en jornada ${jornada} (intento ${attempt}):`, err.message);
    }

    if (attempt < 3) {
      const waitMs = attempt * 5_000;
      console.log(`  Esperando ${waitMs / 1000}s...`);
      await new Promise((r) => setTimeout(r, waitMs));

      // Renovar sesión
      try {
        session = await createRfcylfHttpSession();
      } catch (e: any) {
        console.error("  Error renovando sesión:", e.message);
      }
    }
  }

  throw new Error(`No se pudo descargar la jornada ${jornada} tras 3 intentos.`);
}

/**
 * Descarga el PDF de un acta en memoria (Buffer).
 * Reintenta hasta 3 veces.
 */
export async function downloadPdfToMemory(
  session: RfcylfHttpSession,
  codActa: string,
  refererUrl: string
): Promise<{ buffer: Buffer; session: RfcylfHttpSession }> {
  const url = getPdfUrl(codActa);

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`  Acta ${codActa}: descargando PDF (intento ${attempt}/3)...`);

      const res = await fetchWithCookies(url, session.cookies, {
        Accept: "application/pdf,text/html;q=0.9,*/*;q=0.8",
        Referer: refererUrl,
      });

      const updatedSession: RfcylfHttpSession = { cookies: res.cookies };
      const ab = await res.arrayBuffer();
      const buffer = Buffer.from(ab);

      console.log(
        `  Acta ${codActa}: status=${res.status}, bytes=${buffer.length}`
      );

      // Verificar que es realmente un PDF
      const isPdf =
        buffer.length > 1_000 &&
        (buffer.subarray(0, 4).toString() === "%PDF" ||
          buffer.subarray(0, 4).toString("hex") === "25504446"); // %PDF en hex

      if (isPdf) {
        return { buffer, session: updatedSession };
      }

      console.log(
        `  El acta ${codActa} no devolvió un PDF válido (bytes=${buffer.length}, inicio="${buffer.subarray(0, 8).toString()}"). Reintentando...`
      );
    } catch (err: any) {
      console.error(`  Error descargando acta ${codActa} (intento ${attempt}):`, err.message);
    }

    if (attempt < 3) {
      const waitMs = attempt * 5_000;
      console.log(`  Esperando ${waitMs / 1000}s...`);
      await new Promise((r) => setTimeout(r, waitMs));

      // Renovar sesión visitando la jornada de referencia
      try {
        session = await createRfcylfHttpSession();
      } catch (e: any) {
        console.error("  Error renovando sesión:", e.message);
      }
    }
  }

  throw new Error(
    `No se pudo descargar el PDF del acta ${codActa} tras 3 intentos.`
  );
}
