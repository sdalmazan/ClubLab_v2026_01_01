/**
 * ClubLab v2026.01.01 — Exercise Taxonomy Constants
 * Defines categories, tactical concepts, muscle groups, and scope labels.
 */

export const EXERCISE_CATEGORIES = [
  { key: 'activacion', label: 'Introducción / Activación', color: 'emerald', subcategories: [
    'Rondos',
    'Ruedas de Pase / Técnica Colectiva',
    'Juegos de Activación / Lúdicos',
  ]},
  { key: 'posesion', label: 'Posesión', color: 'sky', subcategories: [
    'Conservaciones / Posesiones Puras',
    'Juegos de Posición',
  ]},
  { key: 'progresion', label: 'Progresión y Fase Ofensiva', color: 'violet', subcategories: [
    'Progresiones / Evoluciones',
    'Oleadas (2x1, 3x2, 4x3)',
  ]},
  { key: 'definicion', label: 'Definición y Bloque Final', color: 'amber', subcategories: [
    'Finalizaciones',
    'Acciones Combinativas con Tiro',
  ]},
  { key: 'espacio_reducido', label: 'Espacio Reducido / Condicionadas', color: 'orange', subcategories: [
    'Partidos Reducidos (SSG)',
    'Partidos Condicionados',
  ]},
  { key: 'global', label: 'Tareas Globales / Competitivas', color: 'rose', subcategories: [
    'Partido Aplicado / Formal',
  ]},
  { key: 'abp', label: 'Acciones a Balón Parado (ABP)', color: 'cyan', subcategories: [
    'ABP Ofensivo',
    'ABP Defensivo',
  ]},
  { key: 'transiciones', label: 'Transiciones', color: 'indigo', subcategories: [
    'Transición Ataque-Defensa',
    'Transición Defensa-Ataque',
  ]},
] as const;

export const TACTICAL_CONCEPTS = [
  // Fase Ofensiva
  { key: 'salida_balon', label: 'Salida de Balón', category: 'Fase Ofensiva' },
  { key: 'progresion_canalizacion', label: 'Progresión / Canalización', category: 'Fase Ofensiva' },
  { key: 'amplitud_profundidad', label: 'Amplitud y Profundidad', category: 'Fase Ofensiva' },
  { key: 'juego_posicion', label: 'Juego de Posición / Tercer Hombre', category: 'Fase Ofensiva' },
  { key: 'finalizacion', label: 'Finalización / Ocupación del Área', category: 'Fase Ofensiva' },
  // Fase Defensiva
  { key: 'bloque_alto', label: 'Bloque Alto / Presión Alta', category: 'Fase Defensiva' },
  { key: 'bloque_medio', label: 'Bloque Medio / Repliegue Medio', category: 'Fase Defensiva' },
  { key: 'bloque_bajo', label: 'Bloque Bajo / Defensa de Área', category: 'Fase Defensiva' },
  { key: 'basculacion', label: 'Bascualción / Orientación de Ayuda', category: 'Fase Defensiva' },
  { key: 'vigilancias_defensivas', label: 'Vigilancias Defensivas', category: 'Fase Defensiva' },
  // Transiciones
  { key: 'presion_tras_perdida', label: 'Presión Tras Pérdida (PTP)', category: 'Transición A-D' },
  { key: 'repliegue_intensivo', label: 'Repliegue Intensivo', category: 'Transición A-D' },
  { key: 'contraataque', label: 'Contraataque / Transición Rápida', category: 'Transición D-A' },
  { key: 'asegurar_pase', label: 'Asegurar Primer Pase / Conservación', category: 'Transición D-A' },
  // ABP
  { key: 'abp_ofensivo', label: 'ABP Ofensivo', category: 'ABP' },
  { key: 'abp_defensivo', label: 'ABP Defensivo', category: 'ABP' },
] as const;

export const MUSCLE_GROUPS = [
  // Cadena Posterior
  { key: 'isquiotibiales', label: 'Isquiotibiales', zone: 'Cadena Posterior' },
  { key: 'gluteos', label: 'Glúteos (Mayor y Medio)', zone: 'Cadena Posterior' },
  { key: 'triceps_sural', label: 'Tríceps Sural (Gemelos y Sóleo)', zone: 'Cadena Posterior' },
  // Cadena Anterior y Zona Media
  { key: 'cuadriceps', label: 'Cuádriceps', zone: 'Cadena Anterior' },
  { key: 'core_zona_media', label: 'Core / Zona Media', zone: 'Cadena Anterior' },
  // Cadera-Ingle
  { key: 'aductores', label: 'Aductores / Pubis', zone: 'Cadera-Ingle' },
  { key: 'flexores_cadera', label: 'Flexores de Cadera (Psóas Ilíaco)', zone: 'Cadera-Ingle' },
  // General
  { key: 'general_aerobico', label: 'Resistencia Aeróbica (General)', zone: 'General' },
  { key: 'velocidad_sprint', label: 'Velocidad / Sprint', zone: 'General' },
  { key: 'fuerza_explosiva', label: 'Fuerza Explosiva / Salto', zone: 'General' },
] as const;

export const LIBRARY_SCOPE_LABELS = {
  global: 'Biblioteca Estándar (Global)',
  academy: 'Biblioteca de Academia',
  coach: 'Mi Biblioteca',
} as const;

export type ExerciseCategoryKey = (typeof EXERCISE_CATEGORIES)[number]['key'];
export type TacticalConceptKey = (typeof TACTICAL_CONCEPTS)[number]['key'];
export type MuscleGroupKey = (typeof MUSCLE_GROUPS)[number]['key'];
export type LibraryScope = keyof typeof LIBRARY_SCOPE_LABELS;
