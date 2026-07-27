/**
 * ClubLab v2026.01.02 — Print & Export PDF Utility Helpers
 * Formats PDF filenames and prepares async DOM elements before printing
 */

/**
 * Generates dynamic PDF filename: [NOMBRE SESIÓN] — [NOMBRE CLUB] — [FECHA].pdf
 */
export function getTrainingSessionPdfFilename(session: any, clubName?: string): string {
  const rawTitle = session?.title || "Sesión de Entrenamiento";
  const rawClub = clubName || session?.organizationSettings?.club_name || "SD Almazán";
  
  let dateStr = "";
  if (session?.date) {
    const d = new Date(session.date);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    dateStr = `${day}-${month}-${year}`;
  } else {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    dateStr = `${day}-${month}-${year}`;
  }

  // Sanitise file name characters
  const cleanTitle = rawTitle.replace(/[\\/:*?"<>|]/g, "").trim();
  const cleanClub = rawClub.replace(/[\\/:*?"<>|]/g, "").trim();

  return `${cleanTitle} — ${cleanClub} — ${dateStr}`;
}

export async function prepareAndPrintDocument(
  session?: any,
  clubName?: string,
  rootId: string = "clublab-print-root"
): Promise<void> {
  if (typeof window === "undefined") return;

  // Set document title temporarily so Chrome's Save as PDF uses the exact session filename
  const originalTitle = document.title;
  if (session) {
    document.title = getTrainingSessionPdfFilename(session, clubName);
  }

  // 1. Wait for document fonts to be ready
  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Continue if fonts API fails
    }
  }

  // 2. Locate print container element
  const container = document.getElementById(rootId) || document.body;

  // 3. Wait for all images inside print container to load
  const images = Array.from(container.querySelectorAll("img"));
  if (images.length > 0) {
    await Promise.all(
      images.map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
        });
      })
    );
  }

  // 4. Double requestAnimationFrame tick to flush SVG calculations
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  // 5. Trigger native browser print dialog
  window.print();

  // 6. Restore original document title after a short delay
  setTimeout(() => {
    document.title = originalTitle;
  }, 1000);
}
