export const VALIDATED_COLORS = [
  // Emerald / Greens
  { name: "Verde Esmeralda", hex: "#10b981" },
  { name: "Esmeralda Oscuro", hex: "#059669" },
  { name: "Esmeralda Claro", hex: "#34d399" },
  { name: "Verde Césped", hex: "#22c55e" },
  { name: "Verde Bosque", hex: "#16a34a" },
  { name: "Verde Menta", hex: "#4ade80" },
  { name: "Verde Azulado", hex: "#14b8a6" },
  { name: "Teal Oscuro", hex: "#0d9488" },
  { name: "Teal Claro", hex: "#2dd4bf" },
  // Cyans / Sky
  { name: "Cian Eléctrico", hex: "#06b6d4" },
  { name: "Cian Oscuro", hex: "#0891b2" },
  { name: "Cian Suave", hex: "#22d3ee" },
  { name: "Celeste Sky", hex: "#0ea5e9" },
  { name: "Celeste Oscuro", hex: "#0284c7" },
  { name: "Celeste Claro", hex: "#38bdf8" },
  // Blues
  { name: "Azul Real", hex: "#3b82f6" },
  { name: "Azul Marino", hex: "#2563eb" },
  { name: "Azul Suave", hex: "#60a5fa" },
  { name: "Azul Cobalto", hex: "#1d4ed8" },
  { name: "Azul Hielo", hex: "#93c5fd" },
  // Indigos / Purples
  { name: "Añil Premium", hex: "#6366f1" },
  { name: "Añil Oscuro", hex: "#4f46e5" },
  { name: "Añil Suave", hex: "#818cf8" },
  { name: "Violeta Vibrante", hex: "#8b5cf6" },
  { name: "Violeta Oscuro", hex: "#7c3aed" },
  { name: "Violeta Claro", hex: "#a78bfa" },
  { name: "Púrpura", hex: "#a855f7" },
  { name: "Púrpura Oscuro", hex: "#9333ea" },
  { name: "Púrpura Claro", hex: "#c084fc" },
  { name: "Fucsia", hex: "#d946ef" },
  { name: "Fucsia Oscuro", hex: "#c026d3" },
  { name: "Fucsia Claro", hex: "#e879f9" },
  // Pinks / Roses
  { name: "Rosa Chicle", hex: "#ec4899" },
  { name: "Rosa Oscuro", hex: "#db2777" },
  { name: "Rosa Claro", hex: "#f472b6" },
  { name: "Rosa Fuerte", hex: "#f43f5e" },
  { name: "Rosa Oscuro II", hex: "#e11d48" },
  { name: "Rosa Pastel", hex: "#fb7185" },
  // Reds / Oranges
  { name: "Rojo Fuego", hex: "#ef4444" },
  { name: "Rojo Oscuro", hex: "#dc2626" },
  { name: "Rojo Claro", hex: "#f87171" },
  { name: "Naranja Vibrante", hex: "#f97316" },
  { name: "Naranja Oscuro", hex: "#ea580c" },
  { name: "Naranja Claro", hex: "#fb923c" },
  // Ambers / Golds
  { name: "Ámbar Sol", hex: "#f59e0b" },
  { name: "Ámbar Oscuro", hex: "#d97706" },
  { name: "Ámbar Claro", hex: "#fbbf24" },
  { name: "Oro Amarillo", hex: "#eab308" },
  { name: "Oro Oscuro", hex: "#ca8a04" },
  { name: "Oro Claro", hex: "#facc15" },
  // Neutrals (White, Black, Grays)
  { name: "Blanco Puro", hex: "#ffffff" },
  { name: "Negro Carbón", hex: "#000000" },
  { name: "Gris Claro", hex: "#d1d5db" },
  { name: "Gris Medio", hex: "#9ca3af" },
  { name: "Gris Oscuro", hex: "#374151" },
  // Earths / Browns
  { name: "Marrón Chocolate", hex: "#5c3a21" },
  { name: "Marrón Arcilla", hex: "#8b4513" },
  { name: "Beige / Marrón Claro", hex: "#d2b48c" },
];

function hexToRgb(hex: string) {
  // Normalize shorthand hex like #03f to #0033ff
  let cleanHex = hex.replace("#", "").trim();
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split("").map((c) => c + c).join("");
  }
  const bigint = parseInt(cleanHex, 16);
  if (isNaN(bigint)) {
    return { r: 16, g: 185, b: 129 }; // Emerald default
  }
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return { r, g, b };
}

function colorDistance(
  c1: { r: number; g: number; b: number },
  c2: { r: number; g: number; b: number }
) {
  return Math.sqrt(
    Math.pow(c1.r - c2.r, 2) + Math.pow(c1.g - c2.g, 2) + Math.pow(c1.b - c2.b, 2)
  );
}

export function findClosestValidatedColor(targetHex: string): string {
  if (!targetHex) return "#10b981"; // Emerald default
  try {
    const targetRgb = hexToRgb(targetHex);
    let minDistance = Infinity;
    let closestColor = VALIDATED_COLORS[0].hex;

    for (const color of VALIDATED_COLORS) {
      const rgb = hexToRgb(color.hex);
      const dist = colorDistance(targetRgb, rgb);
      if (dist < minDistance) {
        minDistance = dist;
        closestColor = color.hex;
      }
    }
    return closestColor;
  } catch (e) {
    return targetHex;
  }
}
