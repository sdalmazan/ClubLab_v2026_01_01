/**
 * ClubLab v2026.01.02 — Pitch Dimensions & Methodological Calculator
 * Cuantificación de cargas y diseño de espacios de entrenamiento (Small-Sided Games)
 */

export type PitchSpaceType = 'Reducido' | 'Medio' | 'Amplio';

export interface PitchCalculationResult {
  N: number;
  spaceType: PitchSpaceType;
  isDefaultType: boolean;
  largo: number;
  ancho: number;
  areaTotal: number;
  apjReal: number;
  min: {
    largo: number;
    ancho: number;
    area: number;
    apj: number;
  };
  max: {
    largo: number;
    ancho: number;
    area: number;
    apj: number;
  };
  impactoFisico: string;
  orientacionTactica: string;
  formattedMarkdown: string;
  formattedDimensionsShort: string; // e.g. "30m × 20m"
}

export interface ParsedPlayerInfo {
  totalPlayers: number;
  team1: number;
  team2: number;
  extras: number;
  rawMatch: string;
  spaceTypeHint?: PitchSpaceType;
}

/**
 * Normaliza y analiza un texto en busca de configuraciones de jugadores (ej. 5v5, 4v4+2, 2v2 + Porteros)
 */
export function parsePlayerCount(text?: string | null): ParsedPlayerInfo | null {
  if (!text || typeof text !== 'string') return null;

  // 1. Detectar tipología explícita en el texto si la hubiera
  let spaceTypeHint: PitchSpaceType | undefined = undefined;
  if (/amplio|campo completo|largo/i.test(text)) {
    spaceTypeHint = 'Amplio';
  } else if (/medio|medio campo|sector medio/i.test(text)) {
    spaceTypeHint = 'Medio';
  } else if (/reducido|espacio reducido|rondo|ssg/i.test(text)) {
    spaceTypeHint = 'Reducido';
  }

  // 2. Buscar patrón principal XvY (ej. 5v5, 4v4, 2v2, 11v11, 5v3, 3v2)
  const mainRegex = /(\d+)\s*v\s*(\d+)/i;
  const match = text.match(mainRegex);

  if (match) {
    const team1 = parseInt(match[1], 10);
    const team2 = parseInt(match[2], 10);
    let extras = 0;
    let rawMatch = match[0];

    // Buscar comodines o extras después del XvY
    // Ejemplos: "+ 2 comodines", "+ 2", "+ comodines", "+ porteros", "+ 2 porteros"
    const subText = text.substring(match.index! + match[0].length);
    const extraRegex = /^\s*\+\s*(\d+)?\s*(comodin|comodines|joker|jokers|portero|porteros|gk|apoyo|apoyos|mediocentro)?/i;
    const extraMatch = subText.match(extraRegex);

    if (extraMatch) {
      rawMatch += extraMatch[0];
      if (extraMatch[1]) {
        extras = parseInt(extraMatch[1], 10);
      } else if (extraMatch[2]) {
        const word = extraMatch[2].toLowerCase();
        if (word.includes('porteros') || word.includes('comodines') || word.includes('jokers') || word.includes('apoyos')) {
          extras = 2;
        } else {
          extras = 1;
        }
      }
    } else {
      // Buscar mención independiente de porteros/comodines cercana en el texto si no está con '+'
      if (/con\s+porteros|y\s+porteros/i.test(text)) {
        extras += 2;
      } else if (/con\s+portero|y\s+portero/i.test(text)) {
        extras += 1;
      }
      if (/con\s+(\d+)\s+comodin/i.test(text)) {
        const mCom = text.match(/con\s+(\d+)\s+comodin/i);
        if (mCom) extras += parseInt(mCom[1], 10);
      }
    }

    const total = team1 + team2 + extras;
    return {
      totalPlayers: total,
      team1,
      team2,
      extras,
      rawMatch: rawMatch.trim(),
      spaceTypeHint,
    };
  }

  // 3. Buscar mención directa de número total de jugadores (ej. "10 jugadores", "8 participantes")
  const directRegex = /(\d+)\s*(?:jugadores|participantes|pax)/i;
  const directMatch = text.match(directRegex);
  if (directMatch) {
    const total = parseInt(directMatch[1], 10);
    return {
      totalPlayers: total,
      team1: 0,
      team2: 0,
      extras: total,
      rawMatch: directMatch[0],
      spaceTypeHint,
    };
  }

  return null;
}

/**
 * Calcula el espacio recomendado según el número de participantes N y el objetivo metodológico.
 */
export function calculatePitchDimensions(
  N: number,
  typeInput?: string | null
): PitchCalculationResult {
  const normalizedType = (typeInput || '').trim();
  const isDefaultType =
    !normalizedType ||
    (normalizedType !== 'Medio' && normalizedType !== 'Amplio' && normalizedType !== 'Reducido');

  const spaceType: PitchSpaceType = isDefaultType
    ? 'Reducido'
    : (normalizedType as PitchSpaceType);

  let apjRef = 60;
  let apjMinRef = 50;
  let apjMaxRef = 70;

  if (spaceType === 'Medio') {
    apjRef = 100;
    apjMinRef = 80;
    apjMaxRef = 110;
  } else if (spaceType === 'Amplio') {
    apjRef = 140;
    apjMinRef = 120;
    apjMaxRef = 160;
  }

  // 1. Medidas principales (Aspect Ratio 1.5 : 1)
  const areaTarget = N * apjRef;
  const ancho = Math.round(Math.sqrt(areaTarget / 1.5));
  const largo = Math.round(ancho * 1.5);
  const areaTotal = largo * ancho;
  const apjReal = Math.round((areaTotal / N) * 10) / 10;

  // 2. Margen Espacio Mínimo
  const areaMinTarget = N * apjMinRef;
  const anchoMin = Math.round(Math.sqrt(areaMinTarget / 1.5));
  const largoMin = Math.round(anchoMin * 1.5);
  const areaMin = largoMin * anchoMin;
  const apjMinReal = Math.round((areaMin / N) * 10) / 10;

  // 3. Margen Espacio Máximo
  const areaMaxTarget = N * apjMaxRef;
  const anchoMax = Math.round(Math.sqrt(areaMaxTarget / 1.5));
  const largoMax = Math.round(anchoMax * 1.5);
  const areaMax = largoMax * anchoMax;
  const apjMaxReal = Math.round((areaMax / N) * 10) / 10;

  // Estímulos físicos y tácticos
  let impactoFisico = '';
  let orientacionTactica = '';

  if (spaceType === 'Reducido') {
    impactoFisico =
      'Aceleraciones/desaceleraciones de alta frecuencia, elevada densidad de duelos, cambios de dirección reactivos y alta carga neuromuscular metabólica en distancias cortas.';
    orientacionTactica =
      'Toma de decisión ultra-rápida bajo presión alta, orientación del primer toque, mantenimiento de posesión en espacio reducido y repliegue/presión tras pérdida inmediata.';
  } else if (spaceType === 'Medio') {
    impactoFisico =
      'Carrera de alta intensidad (HIR), transiciones continuas ataque-defensa a media distancia y capacidad de esfuerzos repetidos (RSA).';
    orientacionTactica =
      'Mantenimiento de posesión con progresión vertical, cambios de orientación de juego, ocupación de líneas intermedias y fijación de rivales para generar ventajas.';
  } else {
    impactoFisico =
      'Esprints a alta velocidad (>21-24 km/h), amplias distancias recorridas en aceleración libre y potencia aeróbica específica en espacio abierto.';
    orientacionTactica =
      'Desmarques en profundidad, ataques continuos por banda con centros y remates, máxima amplitud y profundidad ofensiva.';
  }

  const formattedMarkdown = `## 📐 Dimensiones Recomendadas

* **Datos de origen:** ${N} jugadores | Espacio: ${spaceType} ${isDefaultType ? '*(Asumido por defecto)*' : ''}
* **Medidas principales:** **${largo}m × ${ancho}m**
* **Superficie total:** ${areaTotal} m² (APJ ≈ ${apjReal} m²/jugador)

---

### ⚡ Estímulo Metodológico y Físico
* **Impacto físico primario:** ${impactoFisico}
* **Orientación táctica:** ${orientacionTactica}

---

### 🎛️ Margen de Ajuste en Campo
* **Espacio Mínimo (mayor intensidad/dificultad):** ${largoMin}m × ${anchoMin}m (APJ ≈ ${apjMinReal} m²)
* **Espacio Máximo (mayor fluidez/facilidad):** ${largoMax}m × ${anchoMax}m (APJ ≈ ${apjMaxReal} m²)`;

  return {
    N,
    spaceType,
    isDefaultType,
    largo,
    ancho,
    areaTotal,
    apjReal,
    min: {
      largo: largoMin,
      ancho: anchoMin,
      area: areaMin,
      apj: apjMinReal,
    },
    max: {
      largo: largoMax,
      ancho: anchoMax,
      area: areaMax,
      apj: apjMaxReal,
    },
    impactoFisico,
    orientacionTactica,
    formattedMarkdown,
    formattedDimensionsShort: `${largo}m × ${ancho}m`,
  };
}

/**
 * Dado un objeto de tarea o varios campos, busca automáticamente el número de jugadores N
 * y genera la recomendación de espacio y el reporte metodológico.
 */
export function autoCalculateTaskPitch(task: {
  title?: string | null;
  description?: string | null;
  players_per_group?: string | null;
  space_dimensions?: string | null;
}, preferredSpaceType?: string | null): PitchCalculationResult | null {
  const combinedText = `${task.title || ''} ${task.description || ''} ${task.players_per_group || ''}`;
  const parsed = parsePlayerCount(combinedText);

  if (!parsed || parsed.totalPlayers <= 0) return null;

  const spaceType = preferredSpaceType || parsed.spaceTypeHint || 'Reducido';
  return calculatePitchDimensions(parsed.totalPlayers, spaceType);
}
