import { TACTICAL_CONCEPTS, MUSCLE_GROUPS, EXERCISE_CATEGORIES } from "./exercise-taxonomy";

export interface ParsedOntology {
  physical_objectives: string[];
  tactical_objectives: string[];
  tactical_concept_keys: string[];
  muscle_group_keys: string[];
}

export function parseSessionOntology(rawPhysical?: string | null, rawTactical?: string | null): ParsedOntology {
  const result: ParsedOntology = {
    physical_objectives: [],
    tactical_objectives: [],
    tactical_concept_keys: [],
    muscle_group_keys: [],
  };

  if (rawPhysical) {
    const physText = rawPhysical.trim();
    result.physical_objectives.push(physText);

    const norm = physText.toLowerCase();
    if (norm.includes("resistencia") || norm.includes("aerobico")) {
      result.muscle_group_keys.push("resistencia");
    }
    if (norm.includes("fuerza") || norm.includes("core") || norm.includes("superior")) {
      result.muscle_group_keys.push("core_zona_media");
    }
    if (norm.includes("velocidad") || norm.includes("sprint")) {
      result.muscle_group_keys.push("velocidad");
    }
  }

  if (rawTactical) {
    const tactText = rawTactical.trim();
    result.tactical_objectives.push(tactText);

    const norm = tactText.toLowerCase();

    // Map tactical terms to ontology keys
    if (norm.includes("conservaci") || norm.includes("posesion") || norm.includes("posesión")) {
      result.tactical_concept_keys.push("asegurar_pase");
      result.tactical_concept_keys.push("juego_posicion");
    }
    if (norm.includes("presion") || norm.includes("presión") || norm.includes("tras perdida") || norm.includes("tras pérdida") || norm.includes("ptp")) {
      result.tactical_concept_keys.push("presion_tras_perdida");
    }
    if (norm.includes("progresi") || norm.includes("canalizaci")) {
      result.tactical_concept_keys.push("progresion_canalizacion");
    }
    if (norm.includes("toma de contacto") || norm.includes("tecnico") || norm.includes("técnico")) {
      result.tactical_concept_keys.push("toma_contacto_tecnico");
    }
    if (norm.includes("salida de balon") || norm.includes("salida de balón")) {
      result.tactical_concept_keys.push("salida_balon");
    }
    if (norm.includes("finaliza") || norm.includes("tiro") || norm.includes("remate")) {
      result.tactical_concept_keys.push("finalizacion");
    }
  }

  // Deduplicate
  result.tactical_concept_keys = Array.from(new Set(result.tactical_concept_keys));
  result.muscle_group_keys = Array.from(new Set(result.muscle_group_keys));

  return result;
}

export function cleanTaskTitle(rawTitle: string): string {
  let title = rawTitle.trim();
  // Strip leading words like DOS, UN, UNA, TRES, CUATRO if referring to repetition count
  title = title.replace(/^(DOS|UN|UNA|TRES|CUATRO|CINCO)\s+/i, "");
  return title;
}
