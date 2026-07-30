import { config } from "dotenv";
import path from "path";
config({ path: path.resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";
import sessionData from "../scratch/session2_data.json";
import { recalculateAndSaveSessionMetrics } from "../src/services/sessions";
import { parseSessionOntology, cleanTaskTitle } from "../src/lib/session-ontology";

const PABLO_AYUSO_ID = "0a607008-9066-4da0-affc-175e6e217efa";
const ALMAZAN_TEAM_ID = "26e2583c-d367-40a5-be3a-f9ad0225222d";
const ALMAZAN_ORG_ID = "2ef4ac4a-833a-4acf-8738-ac89d52d1a9d";

const PLAYER_MAP: Record<string, string> = {
  "JAVI M. (P)": "28eb840b-ed1a-4b16-83d2-ced3556586a1",
  "D. MADRUGA": "b5d1b25e-2cd9-4e95-a7da-73280ab3d1a4",
  "DANI MNEZ.": "02294606-9960-4ab4-bb34-bdd9e20cfa88",
  "SANTA": "38807a85-9df2-43b7-89b3-ad4e6f999cb3",
  "HECTOR P. CT": "8fc2743e-0853-4530-b53e-85f09903592d",
  "ALONSO": "ae16f374-7043-45b3-b247-8a76e82d0a53",
  "TONI VAREA (P)": "2fac4a7c-4464-4c57-9775-869f28cc7b71",
  "VICTOR M.": "d923d50a-75a2-4526-8177-774d5bbf3378",
  "HAME": "b02c8e5a-8f41-4ca7-9b73-b1d90e463d74",
  "VILLANUEVA": "9c2f97de-a166-4a3b-94da-b767e118780b",
  "SOHAYB DC": "086c6d8d-3106-47de-85f8-ead60bf6f0ea",
  "RAYNER": "4edb66b2-bf0d-4cf0-b713-c36e2ea0cc9f",
  "LOSILLA": "1a33487d-3365-4d64-9b54-eecd54b664db",
  "YAGO": "045af1e0-16e9-4a46-b831-c799c8d45b72",
  "HUGUI": "3f354157-53c2-4637-ab36-0e0b0ff1012e",
  "HUGO MARTI": "d2f53d6d-1ff5-4702-be71-df7ec25299fb",
  "SAMUEL GLEZ": "b2dc7132-ab75-47df-8feb-7dc4a4378e41",
  "EBRI": "0e14afe7-290e-49ee-a55d-1abc41636370",
  "MARCOS GIL": "8bf6194e-6fc4-4ff6-9a1e-96be433c06cd",
  "MIÑAÑA": "102ef082-6239-4cc7-a910-8d289ca2a946",
  "MIÑANA": "102ef082-6239-4cc7-a910-8d289ca2a946",
  "CHECA": "c4c7449e-01bb-4da3-8365-ad4f0a330e8f",
  "ALVARO NEVES": "7445c108-1f9f-4086-b6b2-37e3dd2a12dd",
  "ALBITRE": "9ce7c32f-fd34-4fea-9e2d-478ab734049e",
  "CARLOS ELVIRA": "dbbc4a10-76e7-4725-9818-ef5785608a60",
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

// ─── Generación de Pizarras Tácticas Vectoriales ──────────────────────────
function generateWhiteboardData(taskTitle: string): { zone: string; space_dimensions: string; whiteboard_data: any } {
  if (taskTitle.toLowerCase().includes("previo") || taskTitle.toLowerCase().includes("core")) {
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
          { id: "t1", x: 180, y: 180, text: "CARRERA CONTINUA - PARQUE DE LA ARBOLEDA (10 MIN)", color: "#1e293b" }
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
          { id: "t1", x: 180, y: 110, text: "MOVILIDAD ARTICULAR DINÁMICA (5 MIN)", color: "#1e293b" }
        ]
      }
    };
  }

  if (taskTitle.includes("4vs4+3") || taskTitle.toLowerCase().includes("posesiones")) {
    return {
      zone: "half_field",
      space_dimensions: "2 @ 20x20m",
      whiteboard_data: {
        zone: "half_field",
        markers: [
          { id: "m1", x: 80, y: 100, type: "player", number: "1", color: "#3b82f6" },
          { id: "m2", x: 140, y: 100, type: "player", number: "2", color: "#3b82f6" },
          { id: "m3", x: 80, y: 180, type: "player", number: "3", color: "#3b82f6" },
          { id: "m4", x: 140, y: 180, type: "player", number: "4", color: "#3b82f6" },
          
          { id: "m5", x: 100, y: 120, type: "rival", number: "5", color: "#ef4444" },
          { id: "m6", x: 160, y: 120, type: "rival", number: "6", color: "#ef4444" },
          { id: "m7", x: 100, y: 200, type: "rival", number: "7", color: "#ef4444" },
          { id: "m8", x: 160, y: 200, type: "rival", number: "8", color: "#ef4444" },

          { id: "m9", x: 110, y: 80, type: "player", number: "C1", color: "#f59e0b" },
          { id: "m10", x: 110, y: 220, type: "player", number: "C2", color: "#f59e0b" },
          { id: "m11", x: 120, y: 150, type: "player", number: "C3", color: "#f59e0b" },
          { id: "b1", x: 125, y: 155, type: "ball" },

          { id: "c1", x: 60, y: 80, type: "cone" },
          { id: "c2", x: 180, y: 80, type: "cone" },
          { id: "c3", x: 60, y: 220, type: "cone" },
          { id: "c4", x: 180, y: 220, type: "cone" },

          { id: "m21", x: 380, y: 100, type: "player", number: "1", color: "#3b82f6" },
          { id: "m22", x: 440, y: 100, type: "player", number: "2", color: "#3b82f6" },
          { id: "m23", x: 380, y: 180, type: "player", number: "3", color: "#3b82f6" },
          { id: "m24", x: 440, y: 180, type: "player", number: "4", color: "#3b82f6" },

          { id: "m25", x: 400, y: 120, type: "rival", number: "5", color: "#ef4444" },
          { id: "m26", x: 460, y: 120, type: "rival", number: "6", color: "#ef4444" },
          { id: "m27", x: 400, y: 200, type: "rival", number: "7", color: "#ef4444" },
          { id: "m28", x: 460, y: 200, type: "rival", number: "8", color: "#ef4444" },

          { id: "m29", x: 410, y: 80, type: "player", number: "C1", color: "#f59e0b" },
          { id: "m30", x: 410, y: 220, type: "player", number: "C2", color: "#f59e0b" },
          { id: "m31", x: 420, y: 150, type: "player", number: "C3", color: "#f59e0b" },
          { id: "b2", x: 425, y: 155, type: "ball" },

          { id: "c21", x: 360, y: 80, type: "cone" },
          { id: "c22", x: 480, y: 80, type: "cone" },
          { id: "c23", x: 360, y: 220, type: "cone" },
          { id: "c24", x: 480, y: 220, type: "cone" }
        ],
        strokes: [
          { id: "s1", type: "dashed_rectangle", points: [{ x: 60, y: 80 }, { x: 180, y: 220 }], color: "#64748b", width: 2 },
          { id: "s2", type: "dashed_rectangle", points: [{ x: 360, y: 80 }, { x: 480, y: 220 }], color: "#64748b", width: 2 },
          { id: "s3", type: "arrow", points: [{ x: 80, y: 100 }, { x: 120, y: 150 }], color: "#3b82f6", width: 2 }
        ],
        texts: [
          { id: "t1", x: 80, y: 65, text: "POSESIÓN 1 (20x20m)", color: "#1e293b" },
          { id: "t2", x: 380, y: 65, text: "POSESIÓN 2 (20x20m)", color: "#1e293b" }
        ]
      }
    };
  }

  if (taskTitle.includes("TRICOLOR") || taskTitle.includes("7vs7+7")) {
    return {
      zone: "half_field",
      space_dimensions: "45x35m",
      whiteboard_data: {
        zone: "half_field",
        markers: [
          { id: "e1_1", x: 120, y: 120, type: "player", number: "7", color: "#3b82f6" },
          { id: "e1_2", x: 220, y: 100, type: "player", number: "8", color: "#3b82f6" },
          { id: "e1_3", x: 340, y: 120, type: "player", number: "11", color: "#3b82f6" },
          { id: "e1_4", x: 140, y: 250, type: "player", number: "4", color: "#3b82f6" },

          { id: "e2_1", x: 160, y: 140, type: "rival", number: "9", color: "#ef4444" },
          { id: "e2_2", x: 280, y: 150, type: "rival", number: "10", color: "#ef4444" },
          { id: "e2_3", x: 200, y: 220, type: "rival", number: "6", color: "#ef4444" },

          { id: "e3_1", x: 80, y: 180, type: "player", number: "E3", color: "#10b981" },
          { id: "e3_2", x: 400, y: 180, type: "player", number: "E3", color: "#10b981" },
          { id: "e3_3", x: 240, y: 70, type: "player", number: "E3", color: "#10b981" },
          { id: "e3_4", x: 240, y: 320, type: "player", number: "E3", color: "#10b981" },

          { id: "com1", x: 230, y: 190, type: "player", number: "C", color: "#f59e0b" },
          { id: "b1", x: 235, y: 195, type: "ball" },

          { id: "c1", x: 80, y: 70, type: "cone" },
          { id: "c2", x: 400, y: 70, type: "cone" },
          { id: "c3", x: 80, y: 320, type: "cone" },
          { id: "c4", x: 400, y: 320, type: "cone" }
        ],
        strokes: [
          { id: "s1", type: "dashed_rectangle", points: [{ x: 80, y: 70 }, { x: 400, y: 320 }], color: "#10b981", width: 2.5 },
          { id: "s2", type: "arrow", points: [{ x: 120, y: 120 }, { x: 220, y: 100 }], color: "#3b82f6", width: 2 }
        ],
        texts: [
          { id: "t1", x: 160, y: 50, text: "POSESIÓN TRICOLOR 7v7+7 (Máx 3 toques)", color: "#1e293b" }
        ]
      }
    };
  }

  if (taskTitle.includes("OLEADAS") || taskTitle.includes("6vs6")) {
    return {
      zone: "full_field",
      space_dimensions: "60x40m",
      whiteboard_data: {
        zone: "full_field",
        markers: [
          { id: "g1", x: 20, y: 225, type: "goal_11" },
          { id: "g2", x: 580, y: 225, type: "goal_11" },

          { id: "z1_1", x: 80, y: 150, type: "player", number: "4", color: "#3b82f6" },
          { id: "z1_2", x: 80, y: 300, type: "player", number: "5", color: "#3b82f6" },
          { id: "z1_3", x: 140, y: 225, type: "player", number: "8", color: "#3b82f6" },

          { id: "zc_1", x: 300, y: 225, type: "player", number: "C", color: "#f59e0b" },
          { id: "b1", x: 305, y: 230, type: "ball" },

          { id: "z3_1", x: 460, y: 150, type: "rival", number: "9", color: "#ef4444" },
          { id: "z3_2", x: 460, y: 300, type: "rival", number: "11", color: "#ef4444" },
          { id: "z3_3", x: 520, y: 225, type: "rival", number: "10", color: "#ef4444" }
        ],
        strokes: [
          { id: "s1", type: "dashed_line", points: [{ x: 200, y: 20 }, { x: 200, y: 430 }], color: "#64748b", width: 2 },
          { id: "s2", type: "dashed_line", points: [{ x: 400, y: 20 }, { x: 400, y: 430 }], color: "#64748b", width: 2 },
          { id: "s3", type: "arrow", points: [{ x: 140, y: 225 }, { x: 300, y: 225 }], color: "#3b82f6", width: 2.5 }
        ],
        texts: [
          { id: "t1", x: 180, y: 40, text: "OLEADAS POR ZONAS (Llegar en conducción / 3º hombre)", color: "#1e293b" }
        ]
      }
    };
  }

  if (taskTitle.toLowerCase().includes("estiramientos") || taskTitle.toLowerCase().includes("relajación") || taskTitle.toLowerCase().includes("calma")) {
    return {
      zone: "custom_area",
      space_dimensions: "Césped",
      whiteboard_data: {
        zone: "custom_area",
        markers: [
          { id: "p1", x: 200, y: 150, type: "player", number: "S", color: "#10b981" },
          { id: "p2", x: 300, y: 150, type: "player", number: "S", color: "#10b981" }
        ],
        strokes: [
          { id: "s1", type: "rectangle", points: [{ x: 150, y: 100 }, { x: 350, y: 200 }], color: "#10b981", width: 2 }
        ],
        texts: [
          { id: "t1", x: 160, y: 80, text: "VUELTA A LA CALMA Y ESTIRAMIENTOS (10 MIN)", color: "#1e293b" }
        ]
      }
    };
  }

  // TAREA FÍSICA GENERAL
  return {
    zone: "custom_area",
    space_dimensions: "Gimnasio / Césped",
    whiteboard_data: {
      zone: "custom_area",
      markers: [
        { id: "c1", x: 100, y: 150, type: "cone" },
        { id: "c2", x: 200, y: 150, type: "cone" },
        { id: "c3", x: 300, y: 150, type: "cone" },
        { id: "c4", x: 400, y: 150, type: "cone" }
      ],
      strokes: [
        { id: "s1", type: "line", points: [{ x: 80, y: 150 }, { x: 420, y: 150 }], color: "#f59e0b", width: 3 }
      ],
      texts: [
        { id: "t1", x: 150, y: 100, text: "ESTACIÓN FÍSICA Y CORE (10 MIN)", color: "#1e293b" }
      ]
    }
  };
}

async function main() {
  console.log("═════════════════════════════════════════════════════════════");
  console.log("  PROCESADOR ESTRUCTURAL DE TODOS LOS BLOQUES (0, 1, 2, 3)");
  console.log("═════════════════════════════════════════════════════════════\n");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: dbPlayers } = await supabase.from("players").select("id");
  const validPlayerIds = new Set(dbPlayers?.map(p => p.id));

  // 1. Detección Ontológica
  const rawFisico = "RESISTENCIA";
  const rawTactico = "CONSERVACIÓN DE BALÓN + ACTIVACIÓN PARA PRESIÓN TRAS PÉRDIDA";
  const ontology = parseSessionOntology(rawFisico, rawTactico);

  const sessionId = "853d22a8-1362-436c-b3e0-1f94627e8b6b";
  const sessionDate = "2026-07-28";

  // 2. Estructuración Completa de Todos los Bloques de la Sesión:
  const allTasksConfig = [
    // ──────── BLOQUE 0: PREVIO ENTRENO ────────
    {
      title: "Protocolo de Tren Superior y Core",
      block_type: "block0",
      category: "activacion",
      num_series: 1,
      series_duration_min: 15,
      series_recovery_min: 0,
      total_min: 15,
      rules: "Protocolo previo a entreno en gimnasio (19:15 - 19:30). Enfoque en core y prevención.",
      equipos: null
    },
    // ──────── BLOQUE 1: CALENTAMIENTO ────────
    {
      title: "Carrera continua (Parque de la Arboleda)",
      block_type: "warmup",
      category: "activacion",
      num_series: 1,
      series_duration_min: 10,
      series_recovery_min: 0,
      total_min: 10,
      rules: "Activación General: Carrera continua progresiva por el Parque de la Arboleda.",
      equipos: null
    },
    {
      title: "Movilidad articular",
      block_type: "warmup",
      category: "activacion",
      num_series: 1,
      series_duration_min: 5,
      series_recovery_min: 0,
      total_min: 5,
      rules: "Activación Específica: Ejercicios dinámicos de movilidad articular y flexibilidad activa.",
      equipos: null
    },
    // ──────── BLOQUE 2: PARTE PRINCIPAL ────────
    {
      title: cleanTaskTitle(sessionData.tasks[0].title || "POSESIÓN 4vs4+3"),
      block_type: "main",
      category: "posesion",
      num_series: Number(sessionData.tasks[0].num_series || 2),
      series_duration_min: Number(sessionData.tasks[0].tiempo_serie || 6),
      series_recovery_min: Number(sessionData.tasks[0].tiempo_pausa || 3),
      total_min: Number(sessionData.tasks[0].tiempo_total || 18),
      rules: sessionData.tasks[0].description || "TOQUE LIBRE (INTENTAR JUGAR EN 3)",
      equipos: sessionData.tasks[0].equipos
    },
    {
      title: cleanTaskTitle(sessionData.tasks[1].title || "POSESIÓN TRICOLOR 7vs7+7"),
      block_type: "main",
      category: "posesion",
      num_series: Number(sessionData.tasks[1].num_series || 3),
      series_duration_min: Number(sessionData.tasks[1].tiempo_serie || 6),
      series_recovery_min: Number(sessionData.tasks[1].tiempo_pausa || 3),
      total_min: Number(sessionData.tasks[1].tiempo_total || 27),
      rules: sessionData.tasks[1].description || "3 TOQUES MAXIMO MENOS CUANDO VENGO DE RECUPERAR QUE TENGO TOQUE LIBRE PARA ASEGURAR",
      equipos: sessionData.tasks[1].equipos
    },
    {
      title: cleanTaskTitle(sessionData.tasks[2].title || "PARTIDO POR OLEADAS 6vs6+1c|1c|6+1c"),
      block_type: "main",
      category: "progresion",
      num_series: Number(sessionData.tasks[2].num_series || 2),
      series_duration_min: Number(sessionData.tasks[2].tiempo_serie || 8),
      series_recovery_min: Number(sessionData.tasks[2].tiempo_pausa || 3),
      total_min: Number(sessionData.tasks[2].tiempo_total || 22),
      rules: sessionData.tasks[2].description || "PARA PASAR AL OTRO LADO LLEGAR A ZONA INTERMEDIA EN CONDUCCIÓN O 3º HOMBRE CON COMODÍN LEJANO. SI HAGO GOL SIGO ATACANDO",
      equipos: sessionData.tasks[2].equipos
    },
    {
      title: cleanTaskTitle(sessionData.tasks[3].title || "TREN SUPERIOR Y CORE"),
      block_type: "main",
      category: "activacion",
      num_series: Number(sessionData.tasks[3].num_series || 1),
      series_duration_min: Number(sessionData.tasks[3].tiempo_serie || 10),
      series_recovery_min: Number(sessionData.tasks[3].tiempo_pausa || 3),
      total_min: Number(sessionData.tasks[3].tiempo_total || 13),
      rules: "Estación física de fuerza de tren superior y fortalecimiento de zona media.",
      equipos: sessionData.tasks[3].equipos
    },
    // ──────── BLOQUE 3: VUELTA A LA CALMA ────────
    {
      title: "Estiramientos y relajación muscular",
      block_type: "cooldown",
      category: "activacion",
      num_series: 1,
      series_duration_min: 10,
      series_recovery_min: 0,
      total_min: 10,
      rules: "Vuelta a la calma: Estiramientos estáticos asistidos y relajación muscular.",
      equipos: null
    }
  ];

  console.log(`\n📚 Procesando ${allTasksConfig.length} tareas repartidas en los 4 Bloques (0, 1, 2, 3)...`);
  const sessionExercisesData: any[] = [];

  for (let idx = 0; idx < allTasksConfig.length; idx++) {
    const item = allTasksConfig[idx];
    const wb = generateWhiteboardData(item.title);

    let fullDesc = `📋 Consignas / Normas: ${item.rules}\n\n`;
    if (item.equipos) fullDesc += `👥 Distribución de Equipos:\n${item.equipos}\n\n`;
    fullDesc += `⏱️ Series: ${item.num_series} | Duración/serie: ${item.series_duration_min} min | Pausa: ${item.series_recovery_min} min | Total: ${item.total_min} min`;

    // Buscar o Insertar la tarea en la biblioteca de Pablo Ayuso
    const { data: existingEx } = await supabase
      .from("exercises")
      .select("id")
      .eq("organization_id", ALMAZAN_ORG_ID)
      .eq("created_by", PABLO_AYUSO_ID)
      .eq("title", item.title)
      .maybeSingle();

    let exerciseId = existingEx?.id;

    if (exerciseId) {
      console.log(`   [Bloque ${item.block_type}] Tarea "${item.title}" actualizada en biblioteca [ID: ${exerciseId}].`);
      await supabase
        .from("exercises")
        .update({
          description: fullDesc,
          category: item.category,
          whiteboard_data: wb.whiteboard_data,
          whiteboard_zone: wb.zone,
          space_dimensions: wb.space_dimensions,
          tactical_concepts: ontology.tactical_concept_keys,
          muscle_groups: ontology.muscle_group_keys
        })
        .eq("id", exerciseId);
    } else {
      console.log(`   [Bloque ${item.block_type}] + Creando "${item.title}" en la biblioteca de Pablo Ayuso...`);
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
          tags: ["almazan", "sesion2", item.block_type],
          whiteboard_data: wb.whiteboard_data,
          whiteboard_zone: wb.zone,
          space_dimensions: wb.space_dimensions,
          tactical_concepts: ontology.tactical_concept_keys,
          muscle_groups: ontology.muscle_group_keys,
          needs_groups: Boolean(item.equipos),
          num_groups: item.title.includes("TRICOLOR") ? 3 : item.title.includes("4vs4") ? 2 : 1
        })
        .select("id")
        .single();

      if (exErr || !newEx) {
        console.error(`❌ Error creando "${item.title}":`, exErr?.message);
        continue;
      }
      exerciseId = newEx.id;
    }

    // Serializado exacto para que el frontend SessionForm.tsx des-serialice perfectamente cada bloque y sus pizarras
    const groupSetupPayload = {
      block_type: item.block_type,
      use_variable_series: false,
      series: [],
      num_series: item.num_series,
      series_duration_min: item.series_duration_min,
      series_recovery_min: item.series_recovery_min,
      transition_rest_min: 2,
      rules: item.rules,
      objective_notes: item.equipos || "",
      groups: []
    };

    sessionExercisesData.push({
      organization_id: ALMAZAN_ORG_ID,
      session_id: sessionId,
      exercise_id: exerciseId,
      order_index: idx + 1,
      duration_min: item.total_min,
      recovery_min: item.series_recovery_min,
      space_dimensions: wb.space_dimensions,
      group_setup: groupSetupPayload,
      whiteboard_data: wb.whiteboard_data,
      whiteboard_zone: wb.zone,
      tactical_concepts: ontology.tactical_concept_keys,
      muscle_groups: ontology.muscle_group_keys
    });
  }

  // 3. Actualizar la Cabecera de la Sesión
  console.log("\n📝 Actualizando la Sesión #2 con Ontología y Bloques...");
  const { error: sessionUpdateErr } = await supabase
    .from("training_sessions")
    .update({
      title: "Sesión 2",
      date: sessionDate,
      start_time: sessionData.time,
      duration_min: sessionData.duracion,
      session_type: "training",
      status: "planned",
      objectives: [...ontology.physical_objectives, ...ontology.tactical_objectives],
      tactical_concepts: ontology.tactical_concept_keys,
      muscle_groups: ontology.muscle_group_keys,
      notes: `${sessionData.observaciones}\n\n📌 Previo entreno (19:15-19:30): Protocolo de Tren Superior y Core\n🔥 Calentamiento: Carrera continua + Movilidad articular\n🧘 Vuelta a la calma: Estiramientos y relajación muscular`,
      mesocycle: `MESO ${sessionData.meso}`,
      session_week_seq: sessionData.orden_sem,
      session_total_seq: 2,
      updated_at: new Date().toISOString()
    })
    .eq("id", sessionId);

  if (sessionUpdateErr) {
    console.error("❌ Error actualizando sesión:", sessionUpdateErr.message);
    return;
  }

  // 4. Asistencia
  console.log("\n👥 Registrando asistencia de la plantilla...");
  await supabase.from("session_attendance").delete().eq("session_id", sessionId);

  const attendanceRecords = sessionData.attendance
    .map(att => {
      const playerId = PLAYER_MAP[att.name];
      if (!playerId || !validPlayerIds.has(playerId)) {
        return null;
      }
      return {
        organization_id: ALMAZAN_ORG_ID,
        session_id: sessionId,
        player_id: playerId,
        status: statusToSupabase(att.status),
        notes: `Estado en Excel: ${att.status}`
      };
    })
    .filter(Boolean);

  await supabase.from("session_attendance").insert(attendanceRecords);

  // 5. Vincular Ejercicios a la Sesión (`session_exercises`)
  console.log("\n🎨 Vinculando las 8 tareas con sus bloques (0, 1, 2, 3) y pizarras visuales...");
  await supabase.from("session_exercises").delete().eq("session_id", sessionId);
  const { error: insErr } = await supabase.from("session_exercises").insert(sessionExercisesData);

  if (insErr) {
    console.error("❌ Error insertando session_exercises:", insErr.message);
  } else {
    console.log(`✅ Vinculadas exitosamente las ${sessionExercisesData.length} tareas en sus respectivos bloques.`);
  }

  // 6. Recalcular métricas
  console.log("\n📊 Recalculando métricas de sesión para el equipo...");
  await recalculateAndSaveSessionMetrics(ALMAZAN_TEAM_ID, supabase);

  console.log("\n✨ ¡PROCESO COMPLETADO Y PERFECCIONADO! ✨");
}

main().catch(console.error);
