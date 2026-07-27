/**
 * ClubLab v2026.01.02 — Print Utility Helpers
 * Ensures fonts, images, and SVG elements are fully loaded and rendered before triggering window.print()
 */

export async function prepareAndPrintDocument(rootId: string = "clublab-print-root"): Promise<void> {
  if (typeof window === "undefined") return;

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

  // 4. Double requestAnimationFrame tick to allow SVG layout calculations to flush in DOM
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  // 5. Trigger native browser print dialog
  window.print();
}
