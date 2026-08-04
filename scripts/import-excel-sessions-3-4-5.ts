import { config } from "dotenv";
import path from "path";
config({ path: path.resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";
import { recalculateAndSaveSessionMetrics } from "../src/services/sessions";
import { parseSessionOntology, cleanTaskTitle } from "../src/lib/session-ontology";

const PABLO_AYUSO_ID = "0a607008-9066-4da0-affc-175e6e217efa";
const ALMAZAN_TEAM_ID = "26e2583c-d367-40a5-be3a-f9ad0225222d";
const ALMAZAN_ORG_ID = "2ef4ac4a-833a-4acf-8738-ac89d52d1a9d";

const PLAYER_MAP: Record<string, string> = {
  "JAVI M. (P)": "28eb840b-ed1a-4b16-83d2-ced3556586a1",
  "JAVI": "28eb840b-ed1a-4b16-83d2-ced3556586a1",
  "D. MADRUGA": "b5d1b25e-2cd9-4e95-a7da-73280ab3d1a4",
  "MADRUGA": "b5d1b25e-2cd9-4e95-a7da-73280ab3d1a4",
  "DANI MNEZ.": "02294606-9960-4ab4-bb34-bdd9e20cfa88",
  "DANI": "02294606-9960-4ab4-bb34-bdd9e20cfa88",
  "SANTA": "38807a85-9df2-43b7-89b3-ad4e6f999cb3",
  "HECTOR P. CT": "8fc2743e-0853-4530-b53e-85f09903592d",
  "HECTOR": "8fc2743e-0853-4530-b53e-85f09903592d",
  "ALONSO": "ae16f374-7043-45b3-b247-8a76e82d0a53",
  "TONI VAREA (P)": "2fac4a7c-4464-4c57-9775-869f28cc7b71",
  "TONI": "2fac4a7c-4464-4c57-9775-869f28cc7b71",
  "VICTOR M.": "d923d50a-75a2-4526-8177-774d5bbf3378",
  "VICTOR": "d923d50a-75a2-4526-8177-774d5bbf3378",
  "HAME": "b02c8e5a-8f41-4ca7-9b73-b1d90e463d74",
  "VILLANUEVA": "9c2f97de-a166-4a3b-94da-b767e118780b",
  "VILLA": "9c2f97de-a166-4a3b-94da-b767e118780b",
  "SOHAYB DC": "086c6d8d-3106-47de-85f8-ead60bf6f0ea",
  "SOHA": "086c6d8d-3106-47de-85f8-ead60bf6f0ea",
  "RAYNER": "4edb66b2-bf0d-4cf0-b713-c36e2ea0cc9f",
  "LOSILLA": "1a33487d-3365-4d64-9b54-eecd54b664db",
  "YAGO": "045af1e0-16e9-4a46-b831-c799c8d45b72",
  "HUGUI": "3f354157-53c2-4637-ab36-0e0b0ff1012e",
  "HUGO MARTI": "d2f53d6d-1ff5-4702-be71-df7ec25299fb",
  "MARTI": "d2f53d6d-1ff5-4702-be71-df7ec25299fb",
  "SAMUEL GLEZ": "b2dc7132-ab75-47df-8feb-7dc4a4378e41",
  "SAMU": "b2dc7132-ab75-47df-8feb-7dc4a4378e41",
  "EBRI": "0e14afe7-290e-49ee-a55d-1abc41636370",
  "MARCOS GIL": "8bf6194e-6fc4-4ff6-9a1e-96be433c06cd",
  "GIL": "8bf6194e-6fc4-4ff6-9a1e-96be433c06cd",
  "MIÑAÑA": "102ef082-6239-4cc7-a910-8d289ca2a946",
  "MIÑANA": "102ef082-6239-4cc7-a910-8d289ca2a946",
  "MARCOS ISLA": "627bc9e1-e3f7-4fe3-9c11-743b16e8dea9",
  "ISLA": "627bc9e1-e3f7-4fe3-9c11-743b16e8dea9",
  "CHECA": "c4c7449e-01bb-4da3-8365-ad4f0a330e8f",
  "ALVARO NEVES": "7445c108-1f9f-4086-b6b2-37e3dd2a12dd",
  "NEVES": "7445c108-1f9f-4086-b6b2-37e3dd2a12dd",
  "ALBITRE": "9ce7c32f-fd34-4fea-9e2d-478ab734049e",
  "CARLOS ELVIRA": "dbbc4a10-76e7-4725-9818-ef5785608a60",
  "ELVIRA": "dbbc4a10-76e7-4725-9818-ef5785608a60"
};

function statusToSupabase(status: string): "present" | "injured" | "absent" | "other" {
  switch (status.trim().toUpperCase()) {
    case "S": return "present";
    case "L": return "injured";
    case "V": return "absent";
    case "E": return "absent";
    case "P": return "other";
    default: return "present";
  }
}

function resolvePlayerIds(names: string[]): string[] {
  return names.map(n => PLAYER_MAP[n]).filter(Boolean);
}

function generateWhiteboardData(taskTitle: string): { zone: string; space_dimensions: string; whiteboard_data: any } {
  if (taskTitle.toLowerCase().includes("protocolo") || taskTitle.toLowerCase().includes("core")) {
    return {
      zone: "custom_area",
      space_dimensions: "Gimnasio / Zona Previa",
      whiteboard_data: {
        zone: "custom_area",
        markers: [
          { id: "c1", x: 120, y: 150, type: "cone" },
          { id: "c2", x: 240, y: 150, type: "cone" },
          { id: "c3", x: 360, y: 150, type: "cone" },
          { id: "m1", x: 180, y: 150, type: "player", number: "1", color: "#3b82f6" },
          { id: "m2", x: 300, y: 150, type: "player", number: "2", color: "#3b82f6" }
        ],
        strokes: [
          { id: "s1", type: "rectangle", points: [{ x: 80, y: 100 }, { x: 400, y: 200 }], color: "#f59e0b", width: 2 }
        ],
        texts: [
          { id: "t1", x: 140, y: 80, text: "PROTOCOLO TREN SUPERIOR Y CORE (15 MIN)", color: "#1e293b" }
        ]
      }
    };
  }

  if (taskTitle.toLowerCase().includes("carrera") || taskTitle.toLowerCase().includes("arboleda")) {
    return {
      zone: "full_field",
      space_dimensions: "Parque / Exterior",
      whiteboard_data: {
        zone: "full_field",
        markers: [
          { id: "p1", x: 100, y: 220, type: "player", number: "1", color: "#3b82f6" },
          { id: "p2", x: 140, y: 220, type: "player", number: "2", color: "#3b82f6" },
          { id: "p3", x: 180, y: 220, type: "player", number: "3", color: "#3b82f6" }
        ],
        strokes: [
          { id: "s1", type: "arrow", points: [{ x: 80, y: 220 }, { x: 500, y: 220 }], color: "#22c55e", width: 3 }
        ],
        texts: [
          { id: "t1", x: 180, y: 180, text: "CARRERA CONTINUA - PARQUE DE LA ARBOLEDA", color: "#1e293b" }
        ]
      }
    };
  }

  if (taskTitle.toLowerCase().includes("movilidad")) {
    return {
      zone: "half_field",
      space_dimensions: "Medio Campo",
      whiteboard_data: {
        zone: "half_field",
        markers: [
          { id: "c1", x: 150, y: 150, type: "cone" },
          { id: "c2", x: 350, y: 150, type: "cone" },
          { id: "p1", x: 250, y: 150, type: "player", number: "M", color: "#3b82f6" }
        ],
        strokes: [
          { id: "s1", type: "line", points: [{ x: 150, y: 150 }, { x: 350, y: 150 }], color: "#3b82f6", width: 2 }
        ],
        texts: [
          { id: "t1", x: 180, y: 110, text: "MOVILIDAD ARTICULAR DINÁMICA", color: "#1e293b" }
        ]
      }
    };
  }

  return {
    zone: "half_field",
    space_dimensions: "Campo de Juego",
    whiteboard_data: {
      zone: "half_field",
      markers: [
        { id: "c1", x: 100, y: 100, type: "cone" },
        { id: "c2", x: 400, y: 100, type: "cone" },
        { id: "c3", x: 100, y: 300, type: "cone" },
        { id: "c4", x: 400, y: 300, type: "cone" },
        { id: "p1", x: 250, y: 200, type: "player", number: "1", color: "#3b82f6" },
        { id: "b1", x: 260, y: 205, type: "ball" }
      ],
      strokes: [
        { id: "s1", type: "dashed_rectangle", points: [{ x: 100, y: 100 }, { x: 400, y: 300 }], color: "#3b82f6", width: 2 }
      ],
      texts: [
        { id: "t1", x: 180, y: 80, text: taskTitle.toUpperCase(), color: "#1e293b" }
      ]
    }
  };
}

const SESSIONS_CONFIG = [
  // ─────────────────────────── SESIÓN 3 ───────────────────────────
  {
    sessionId: "12520cfe-77d0-4cd8-ad1e-8c824ac4c0d3",
    title: "Sesión 3",
    sessionDate: "2026-07-30",
    time: "19:30",
    duracion: 99,
    meso: 1,
    micro: 1,
    orden_sem: 3,
    total_seq: 3,
    physical_obj: "FUERZA EXPLOSIVA",
    tactical_obj: "TRANSICIONES DEFENSIVAS Y OFENSIVAS",
    notes: "ENTRENAMIENTO EN HIERBA NATURAL (LA ARBOLEDA).",
    attendance: [
      { name: "JAVI M. (P)", status: "S" },
      { name: "D. MADRUGA", status: "L" },
      { name: "DANI MNEZ.", status: "V" },
      { name: "SANTA", status: "S" },
      { name: "HECTOR P. CT", status: "S" },
      { name: "ALONSO", status: "L" },
      { name: "TONI VAREA (P)", status: "S" },
      { name: "VICTOR M.", status: "S" },
      { name: "HAME", status: "S" },
      { name: "VILLANUEVA", status: "S" },
      { name: "SOHAYB DC", status: "S" },
      { name: "RAYNER", status: "V" },
      { name: "LOSILLA", status: "S" },
      { name: "YAGO", status: "S" },
      { name: "HUGUI", status: "S" },
      { name: "HUGO MARTI", status: "S" },
      { name: "YOUNAIKER MP", status: "S" },
      { name: "SAMUEL GLEZ", status: "S" },
      { name: "EBRI", status: "S" },
      { name: "MARCOS GIL", status: "S" },
      { name: "MIÑAÑA", status: "S" },
      { name: "MARCOS ISLA", status: "L" },
      { name: "CHECA", status: "S" },
      { name: "ALVARO NEVES", status: "S" },
      { name: "ALBITRE", status: "S" },
      { name: "CARLOS ELVIRA", status: "S" }
    ],
    tasks: [
      {
        title: "Protocolo de Tren Superior y Core",
        block_type: "block0",
        category: "activacion",
        num_series: 1,
        series_duration_min: 15,
        series_recovery_min: 0,
        total_min: 15,
        rules: "Protocolo de tren superior y core previo a entreno (19:15 - 19:30).",
        groups: []
      },
      {
        title: "Movilidad articular",
        block_type: "warmup",
        category: "activacion",
        num_series: 1,
        series_duration_min: 5,
        series_recovery_min: 0,
        total_min: 5,
        rules: "Ejercicios dinámicos de movilidad articular.",
        groups: []
      },
      {
        title: "Carrera continua (Parque de la Arboleda)",
        block_type: "warmup",
        category: "activacion",
        num_series: 1,
        series_duration_min: 15,
        series_recovery_min: 0,
        total_min: 15,
        rules: "Carrera continua 3x800 metros por el Parque de la Arboleda.",
        groups: []
      },
      {
        title: "POSESIÓN 3 ZONAS 3 EQUIPOS, 6vs3:3|6+1c",
        block_type: "main",
        category: "posesion",
        num_series: 2,
        series_duration_min: 5,
        series_recovery_min: 3,
        total_min: 16,
        rules: "TOQUE LIBRE. 9 PASES PUEDO PASAR AL OTRO LADO. OBLIGATORIO PASAR BALÓN POR ABAJO (HASTA CINTURA) MENOS SI VIENE DE RECUPERACIÓN. PARA CAMBIAR DE ROL TIRARLA FUERA 3 VECES (cambio rol), RECUPERAR Y PASAR (1 gol) o FINALIZAR A LAS 3 MINIPORTERIAS (2 goles)",
        groups: [
          { name: "Equipo 1", players: resolvePlayerIds(["LOSILLA", "YAGO", "HAME", "SAMU", "ELVIRA", "MARTI"]) },
          { name: "Equipo 2", players: resolvePlayerIds(["EBRI", "CHECA", "VICTOR", "GIL", "YOUNAIKER", "SOHA"]) },
          { name: "Equipo 3", players: resolvePlayerIds(["ALBITRE", "HECTOR", "MIÑAÑA", "HUGUI", "SANTA", "VILLA"]) },
          { name: "Comodín", players: resolvePlayerIds(["NEVES"]) }
        ]
      },
      {
        title: "CONTRAATAQUES POR OLEADAS 5vs3",
        block_type: "main",
        category: "transicion",
        num_series: 2,
        series_duration_min: 7,
        series_recovery_min: 3,
        total_min: 20,
        rules: "ATAQUE + REPLIEGO + DEFIENDO",
        groups: [
          { name: "Equipo 1", players: resolvePlayerIds(["LOSILLA", "YAGO", "YOUNAIKER", "SAMU", "GIL", "ELVIRA"]) },
          { name: "Equipo 2", players: resolvePlayerIds(["EBRI", "CHECA", "VICTOR", "SANTA", "HECTOR", "NEVES"]) },
          { name: "Incorporaciones", players: resolvePlayerIds(["ALBITRE", "SOHA", "VILLA", "MARTI", "HAME", "MIÑAÑA", "HUGUI"]) },
          { name: "Porteros", players: resolvePlayerIds(["TONI", "JAVI"]) }
        ]
      },
      {
        title: "ATAQUE 1vs0 + 2vs1 + 3vs2 POR OLEADAS",
        block_type: "main",
        category: "finalizacion",
        num_series: 2,
        series_duration_min: 7,
        series_recovery_min: 3,
        total_min: 20,
        rules: "Ataque continuo en oleadas progresivas 1v0, 2v1 y 3v2.",
        groups: [
          { name: "Equipo 1", players: resolvePlayerIds(["LOSILLA", "YAGO", "HECTOR", "ELVIRA", "ALBITRE", "SAMU", "SANTA", "HAME", "MARTI", "NEVES"]) },
          { name: "Equipo 2", players: resolvePlayerIds(["EBRI", "CHECA", "VICTOR", "MIÑAÑA", "HUGUI", "GIL", "YOUNAIKER", "VILLA", "SOHA"]) }
        ]
      },
      {
        title: "TREN SUPERIOR Y CORE",
        block_type: "main",
        category: "activacion",
        num_series: 1,
        series_duration_min: 10,
        series_recovery_min: 3,
        total_min: 13,
        rules: "Estación física de fuerza de tren superior y fortalecimiento de zona media.",
        groups: []
      },
      {
        title: "Estiramientos y relajación muscular",
        block_type: "cooldown",
        category: "activacion",
        num_series: 1,
        series_duration_min: 10,
        series_recovery_min: 0,
        total_min: 10,
        rules: "Vuelta a la calma: estiramientos asistidos y relajación muscular.",
        groups: []
      }
    ]
  },

  // ─────────────────────────── SESIÓN 4 ───────────────────────────
  {
    sessionId: "4ecd387d-9b2c-443b-a917-b52ef3b3375a",
    title: "Sesión 4",
    sessionDate: "2026-07-31",
    time: "19:30",
    duracion: 108,
    meso: 1,
    micro: 1,
    orden_sem: 4,
    total_seq: 4,
    physical_obj: "FUERZA COMPETITIVA",
    tactical_obj: "ATAQUE (ESTRUCTURAS DE 3) / DEFENSA (BLOQUE BAJO)",
    notes: "ENTRENAMIENTO EN HIERBA NATURAL (LA ARBOLEDA).",
    attendance: [
      { name: "JAVI M. (P)", status: "S" },
      { name: "D. MADRUGA", status: "L" },
      { name: "DANI MNEZ.", status: "V" },
      { name: "SANTA", status: "S" },
      { name: "HECTOR P. CT", status: "S" },
      { name: "ALONSO", status: "L" },
      { name: "TONI VAREA (P)", status: "S" },
      { name: "VICTOR M.", status: "S" },
      { name: "HAME", status: "S" },
      { name: "VILLANUEVA", status: "S" },
      { name: "SOHAYB DC", status: "S" },
      { name: "RAYNER", status: "S" },
      { name: "LOSILLA", status: "S" },
      { name: "YAGO", status: "S" },
      { name: "HUGUI", status: "S" },
      { name: "HUGO MARTI", status: "S" },
      { name: "YOUNAIKER MP", status: "S" },
      { name: "SAMUEL GLEZ", status: "V" },
      { name: "EBRI", status: "S" },
      { name: "MARCOS GIL", status: "S" },
      { name: "MIÑAÑA", status: "S" },
      { name: "MARCOS ISLA", status: "L" },
      { name: "CHECA", status: "S" },
      { name: "ALVARO NEVES", status: "S" },
      { name: "ALBITRE", status: "S" },
      { name: "CARLOS ELVIRA", status: "S" }
    ],
    tasks: [
      {
        title: "Protocolo de Tren Superior y Core",
        block_type: "block0",
        category: "activacion",
        num_series: 1,
        series_duration_min: 15,
        series_recovery_min: 0,
        total_min: 15,
        rules: "Protocolo de tren superior y core previo a entreno (19:15 - 19:30).",
        groups: []
      },
      {
        title: "Carrera continua 2 vueltas",
        block_type: "warmup",
        category: "activacion",
        num_series: 1,
        series_duration_min: 5,
        series_recovery_min: 0,
        total_min: 5,
        rules: "Carrera continua de activación 2 vueltas al campo.",
        groups: []
      },
      {
        title: "Movilidad articular",
        block_type: "warmup",
        category: "activacion",
        num_series: 1,
        series_duration_min: 5,
        series_recovery_min: 0,
        total_min: 5,
        rules: "Movilidad articular dinámicas.",
        groups: []
      },
      {
        title: "TÉCNICA COLECTIVA + COORDINACIÓN",
        block_type: "main",
        category: "tecnica",
        num_series: 2,
        series_duration_min: 5,
        series_recovery_min: 3,
        total_min: 16,
        rules: "Circuitos de coordinación con pase y control.",
        groups: []
      },
      {
        title: "PARTIDO 10vs10 +1c",
        block_type: "main",
        category: "partido",
        num_series: 2,
        series_duration_min: 15,
        series_recovery_min: 4,
        total_min: 38,
        rules: "DE ÁREA A ÁREA. ATAQUE (ESTRUCTURAS DE 3 EN SALIDA). DEFENSA (BLOQUE BAJO, QUE ATAQUEN POR FUERA + FIJAR CENTROS LATERALES)",
        groups: [
          { name: "Equipo 1", players: resolvePlayerIds(["LOSILLA", "YAGO", "HECTOR", "ELVIRA", "ALBITRE", "GIL", "YOUNAIKER", "MIÑAÑA", "MARTI"]) },
          { name: "Equipo 2", players: resolvePlayerIds(["EBRI", "CHECA", "SANTA", "VICTOR", "VILLA", "NEVES", "HUGUI", "HAME", "SOHA"]) },
          { name: "Comodín", players: resolvePlayerIds(["RAYNER"]) }
        ]
      },
      {
        title: "PARTIDO REDUCIDO 6vs6+1c",
        block_type: "main",
        category: "partido_reducido",
        num_series: 3,
        series_duration_min: 5,
        series_recovery_min: 2,
        total_min: 21,
        rules: "EL EQUIPO QUE DESCANSA TRABAJO DE 15x15 o CORE. A vs B | B vs C | C vs A",
        groups: [
          { name: "Equipo 1", players: resolvePlayerIds(["YAGO", "VICTOR", "ALBITRE", "YOUNAIKER", "HAME", "MARTI"]) },
          { name: "Equipo 2", players: resolvePlayerIds(["LOSILLA", "CHECA", "RAYNER", "NEVES", "ELVIRA", "SOHA"]) },
          { name: "Equipo 3", players: resolvePlayerIds(["EBRI", "HECTOR", "HUGUI", "GIL", "MIÑAÑA", "VILLA"]) },
          { name: "Comodín", players: resolvePlayerIds(["SANTA"]) }
        ]
      },
      {
        title: "TREN SUPERIOR Y CORE",
        block_type: "main",
        category: "activacion",
        num_series: 1,
        series_duration_min: 10,
        series_recovery_min: 3,
        total_min: 13,
        rules: "Estación física de fuerza de tren superior y zona media.",
        groups: []
      },
      {
        title: "Estiramientos y relajación muscular",
        block_type: "cooldown",
        category: "activacion",
        num_series: 1,
        series_duration_min: 10,
        series_recovery_min: 0,
        total_min: 10,
        rules: "Vuelta a la calma: estiramientos asistidos y relajación muscular.",
        groups: []
      }
    ]
  },

  // ─────────────────────────── SESIÓN 5 ───────────────────────────
  {
    sessionId: "69386eb0-c6ab-4416-84c1-6706d8946221",
    title: "Sesión 5",
    sessionDate: "2026-08-03",
    time: "19:30",
    duracion: 113,
    meso: 1,
    micro: 2,
    orden_sem: 1,
    total_seq: 5,
    physical_obj: "RESISTENCIA",
    tactical_obj: "INICIACIÓN CAMPO PROPIO / DEFENSA ORGANIZADA (ÁREA + AYUDA PIVOTES) y PRESIÓN ALTA",
    notes: "ENTRENAMIENTO EN HIERBA NATURAL (LA ARBOLEDA).",
    attendance: [
      { name: "JAVI M. (P)", status: "S" },
      { name: "D. MADRUGA", status: "L" },
      { name: "DANI MNEZ.", status: "S" },
      { name: "SANTA", status: "S" },
      { name: "HECTOR P. CT", status: "S" },
      { name: "ALONSO", status: "S" },
      { name: "TONI VAREA (P)", status: "S" },
      { name: "VICTOR M.", status: "S" },
      { name: "HAME", status: "S" },
      { name: "VILLANUEVA", status: "S" },
      { name: "SOHAYB DC", status: "S" },
      { name: "RAYNER", status: "S" },
      { name: "LOSILLA", status: "S" },
      { name: "YAGO", status: "S" },
      { name: "HUGUI", status: "S" },
      { name: "HUGO MARTI", status: "S" },
      { name: "SAMUEL GLEZ", status: "S" },
      { name: "EBRI", status: "S" },
      { name: "MARCOS GIL", status: "S" },
      { name: "MIÑAÑA", status: "S" },
      { name: "MARCOS ISLA", status: "L" },
      { name: "YOUNAIKER MP", status: "V" },
      { name: "CHECA", status: "S" },
      { name: "ALVARO NEVES", status: "S" },
      { name: "ALBITRE", status: "S" },
      { name: "CARLOS ELVIRA", status: "S" }
    ],
    tasks: [
      {
        title: "Protocolo de Tren Superior y Core",
        block_type: "block0",
        category: "activacion",
        num_series: 1,
        series_duration_min: 15,
        series_recovery_min: 0,
        total_min: 15,
        rules: "Protocolo de tren superior y core previo a entreno (19:15 - 19:30).",
        groups: []
      },
      {
        title: "Movilidad articular",
        block_type: "warmup",
        category: "activacion",
        num_series: 1,
        series_duration_min: 5,
        series_recovery_min: 0,
        total_min: 5,
        rules: "Movilidad articular dinámicas.",
        groups: []
      },
      {
        title: "Carrera continua (Parque de la Arboleda)",
        block_type: "warmup",
        category: "activacion",
        num_series: 1,
        series_duration_min: 15,
        series_recovery_min: 0,
        total_min: 15,
        rules: "Carrera continua 3x800 metros por el Parque de la Arboleda.",
        groups: []
      },
      {
        title: "TÉCNICA COLECTIVA",
        block_type: "main",
        category: "tecnica",
        num_series: 2,
        series_duration_min: 5,
        series_recovery_min: 3,
        total_min: 16,
        rules: "Ruedas de pases y combinaciones colectivas.",
        groups: []
      },
      {
        title: "ATAQUE vs DEFENSA 10vs6 EN INFERIORIDAD EN CAMPO PROPIO",
        block_type: "main",
        category: "tactica",
        num_series: 2,
        series_duration_min: 9,
        series_recovery_min: 3,
        total_min: 24,
        rules: "BASCULACIONES, COBERTURAS, PERMUTAS, DEFENSA DE PIVOTES, DEFENSA DE CENTROS LATERALES, DEFENSA EN INFERIORIDAD EN BANDA",
        groups: [
          { name: "Defensa 1", players: resolvePlayerIds(["LOSILLA", "YAGO", "HECTOR", "ELVIRA", "GIL", "NEVES"]) },
          { name: "Ataque 1", players: resolvePlayerIds(["EBRI", "CHECA", "SANTA", "VICTOR", "RAYNER", "ALBITRE", "ALONSO", "SAMU", "DANI", "HAME", "MIÑAÑA", "HUGUI", "VILLA", "SOHA", "MARTI"]) },
          { name: "Defensa 2", players: resolvePlayerIds(["EBRI", "CHECA", "SANTA", "VICTOR", "DANI", "HUGUI"]) },
          { name: "Ataque 2", players: resolvePlayerIds(["LOSILLA", "YAGO", "HECTOR", "ELVIRA", "RAYNER", "ALBITRE", "ALONSO", "GIL", "NEVES", "HAME", "MIÑAÑA", "SAMU", "VILLA", "SOHA", "MARTI"]) }
        ]
      },
      {
        title: "SALIDA DE BALÓN vs PRESIÓN ALTA 7vs6 + TRANSICIÓN 8vs6",
        block_type: "main",
        category: "salida_balon",
        num_series: 2,
        series_duration_min: 12,
        series_recovery_min: 3,
        total_min: 30,
        rules: "PRESIÓN ALTA EN ROMBO 4-2. SI CONECTO CON LOS DE ARRIBA CON 3º HOMBRE O CONDUCCIÓN HACEMOS ATAQUE RÁPIDO 6vs4 (CON EL QUE CONDUCE O RECIBE DE CARA + LATERALES). CON JUEGO DIRECTO DESDE PORTERO HAGO EL DUELO 4vs4 REAL + 2º",
        groups: [
          { name: "Equipo 1", players: resolvePlayerIds(["LOSILLA", "YAGO", "HECTOR", "ELVIRA", "ALBITRE", "ALONSO", "NEVES", "MIÑAÑA", "VILLA", "MARTI"]) },
          { name: "Equipo 2", players: resolvePlayerIds(["EBRI", "CHECA", "SANTA", "VICTOR", "RAYNER", "GIL", "DANI", "HAME", "HUGUI", "SOHA"]) },
          { name: "Comodín (2º Delantero)", players: resolvePlayerIds(["SAMU"]) }
        ]
      },
      {
        title: "TREN SUPERIOR Y CORE",
        block_type: "main",
        category: "activacion",
        num_series: 1,
        series_duration_min: 10,
        series_recovery_min: 3,
        total_min: 13,
        rules: "Estación física de fuerza de tren superior y zona media.",
        groups: []
      },
      {
        title: "Estiramientos y relajación muscular",
        block_type: "cooldown",
        category: "activacion",
        num_series: 1,
        series_duration_min: 10,
        series_recovery_min: 0,
        total_min: 10,
        rules: "Vuelta a la calma: estiramientos asistidos y relajación muscular.",
        groups: []
      }
    ]
  }
];

async function main() {
  console.log("═════════════════════════════════════════════════════════════");
  console.log("      IMPORTADOR DEFINITIVO DE SESIONES 3, 4 Y 5 A CLUBLAB");
  console.log("═════════════════════════════════════════════════════════════\n");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: dbPlayers } = await supabase.from("players").select("id");
  const validPlayerIds = new Set(dbPlayers?.map(p => p.id));

  for (const sessConfig of SESSIONS_CONFIG) {
    console.log(`\n🚀 PROCESANDO: ${sessConfig.title} (${sessConfig.sessionDate}) [ID: ${sessConfig.sessionId}]`);

    const ontology = parseSessionOntology(sessConfig.physical_obj, sessConfig.tactical_obj);
    const sessionExercisesData: any[] = [];

    for (let idx = 0; idx < sessConfig.tasks.length; idx++) {
      const item = sessConfig.tasks[idx];
      const wb = generateWhiteboardData(item.title);
      const hasGroups = item.groups.length > 0;

      let fullDesc = `📋 Consignas / Normas: ${item.rules}\n\n`;
      fullDesc += `⏱️ Series: ${item.num_series} | Duración/serie: ${item.series_duration_min} min | Pausa: ${item.series_recovery_min} min | Total: ${item.total_min} min`;

      // 1. Buscar o Crear Ejercicio en la Biblioteca
      const { data: existingEx } = await supabase
        .from("exercises")
        .select("id")
        .eq("organization_id", ALMAZAN_ORG_ID)
        .eq("created_by", PABLO_AYUSO_ID)
        .eq("title", item.title)
        .maybeSingle();

      let exerciseId = existingEx?.id;

      if (exerciseId) {
        console.log(`   [Bloque ${item.block_type}] Tarea "${item.title}" en biblioteca [ID: ${exerciseId}].`);
        await supabase
          .from("exercises")
          .update({
            description: fullDesc,
            category: item.category,
            needs_groups: hasGroups,
            num_groups: item.groups.length || 1,
            whiteboard_data: wb.whiteboard_data,
            whiteboard_zone: wb.zone,
            space_dimensions: wb.space_dimensions,
            tactical_concepts: ontology.tactical_concept_keys,
            muscle_groups: ontology.muscle_group_keys
          })
          .eq("id", exerciseId);
      } else {
        console.log(`   [Bloque ${item.block_type}] + Creando "${item.title}" en la biblioteca...`);
        const { data: newEx, error: exErr } = await supabase
          .from("exercises")
          .insert({
            organization_id: ALMAZAN_ORG_ID,
            created_by: PABLO_AYUSO_ID,
            library_scope: "coach",
            is_shared: true,
            title: item.title,
            description: fullDesc,
            category: item.category,
            tags: ["almazan", sessConfig.title.toLowerCase().replace(" ", ""), item.block_type],
            whiteboard_data: wb.whiteboard_data,
            whiteboard_zone: wb.zone,
            space_dimensions: wb.space_dimensions,
            tactical_concepts: ontology.tactical_concept_keys,
            muscle_groups: ontology.muscle_group_keys,
            needs_groups: hasGroups,
            num_groups: item.groups.length || 1
          })
          .select("id")
          .single();

        if (exErr || !newEx) {
          console.error(`❌ Error creando "${item.title}":`, exErr?.message);
          continue;
        }
        exerciseId = newEx.id;
      }

      const groupSetupPayload = {
        block_type: item.block_type,
        use_variable_series: false,
        series: [],
        num_series: item.num_series,
        series_duration_min: item.series_duration_min,
        series_recovery_min: item.series_recovery_min,
        transition_rest_min: 2,
        rules: item.rules,
        objective_notes: "",
        series_rotations: "",
        groups: item.groups
      };

      sessionExercisesData.push({
        organization_id: ALMAZAN_ORG_ID,
        session_id: sessConfig.sessionId,
        exercise_id: exerciseId,
        order_index: idx + 1,
        duration_min: item.total_min,
        recovery_min: item.series_recovery_min,
        space_dimensions: wb.space_dimensions,
        group_setup: groupSetupPayload,
        needs_groups: hasGroups,
        num_groups: item.groups.length || 1,
        whiteboard_data: wb.whiteboard_data,
        whiteboard_zone: wb.zone,
        tactical_concepts: ontology.tactical_concept_keys,
        muscle_groups: ontology.muscle_group_keys
      });
    }

    // 2. Actualizar Cabecera de la Sesión
    console.log(`   📝 Actualizando Cabecera de ${sessConfig.title}...`);
    const { error: sessionUpdateErr } = await supabase
      .from("training_sessions")
      .update({
        title: sessConfig.title,
        date: sessConfig.sessionDate,
        start_time: sessConfig.time,
        duration_min: sessConfig.duracion,
        session_type: "training",
        status: "planned",
        objectives: [sessConfig.physical_obj, sessConfig.tactical_obj],
        tactical_concepts: ontology.tactical_concept_keys,
        muscle_groups: ontology.muscle_group_keys,
        notes: sessConfig.notes,
        mesocycle: `MESO ${sessConfig.meso}`,
        session_week_seq: sessConfig.orden_sem,
        session_total_seq: sessConfig.total_seq,
        updated_at: new Date().toISOString()
      })
      .eq("id", sessConfig.sessionId);

    if (sessionUpdateErr) {
      console.error(`❌ Error actualizando sesión ${sessConfig.title}:`, sessionUpdateErr.message);
      continue;
    }

    // 3. Asistencia
    console.log(`   👥 Registrando asistencia...`);
    await supabase.from("session_attendance").delete().eq("session_id", sessConfig.sessionId);

    const attendanceRecords = sessConfig.attendance
      .map(att => {
        const playerId = PLAYER_MAP[att.name];
        if (!playerId || !validPlayerIds.has(playerId)) {
          return null;
        }
        return {
          organization_id: ALMAZAN_ORG_ID,
          session_id: sessConfig.sessionId,
          player_id: playerId,
          status: statusToSupabase(att.status),
          notes: `Estado en Excel: ${att.status}`
        };
      })
      .filter(Boolean);

    await supabase.from("session_attendance").insert(attendanceRecords);

    // 4. Vincular Ejercicios a la Sesión (`session_exercises`)
    console.log(`   🎨 Insertando los ${sessionExercisesData.length} bloques/tareas en session_exercises...`);
    await supabase.from("session_exercises").delete().eq("session_id", sessConfig.sessionId);
    const { error: insErr } = await supabase.from("session_exercises").insert(sessionExercisesData);

    if (insErr) {
      console.error(`❌ Error insertando session_exercises para ${sessConfig.title}:`, insErr.message);
    } else {
      console.log(`   ✅ Cargadas exitosamente las ${sessionExercisesData.length} tareas de ${sessConfig.title}.`);
    }
  }

  // 5. Recalcular métricas para el equipo
  console.log("\n📊 Recalculando métricas de sesión para el equipo...");
  await recalculateAndSaveSessionMetrics(ALMAZAN_TEAM_ID, supabase);

  console.log("\n✨ ¡CARGA COMPLETADA CON ÉXITO PARA LAS SESIONES 3, 4 Y 5! ✨");
}

main().catch(console.error);
