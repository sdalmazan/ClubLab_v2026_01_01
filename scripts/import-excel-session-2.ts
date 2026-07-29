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

// Dictionary mapping names from Excel to Player IDs in Supabase players table
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

// ─── Generación de Pizarras Tácticas Visuales ──────────────────────────────
function generateWhiteboardData(taskKey: string): { zone: string; space_dimensions: string; whiteboard_data: any } {
  if (taskKey === "TAREA 1" || taskKey.includes("4vs4+3")) {
    return {
      zone: "half_field",
      space_dimensions: "2 @ 20x20m",
      whiteboard_data: {
        zone: "half_field",
        markers: [
          // Cuadrado 1 (Izquierda): 4 Azules, 4 Rojos, 3 Comodines Amarillos
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

          // Conos delim
          { id: "c1", x: 60, y: 80, type: "cone" },
          { id: "c2", x: 180, y: 80, type: "cone" },
          { id: "c3", x: 60, y: 220, type: "cone" },
          { id: "c4", x: 180, y: 220, type: "cone" },

          // Cuadrado 2 (Derecha)
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

  if (taskKey === "TAREA 2" || taskKey.includes("TRICOLOR")) {
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

  if (taskKey === "TAREA 3" || taskKey.includes("OLEADAS")) {
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

  // TAREA 4: TREN SUPERIOR Y CORE
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
        { id: "t1", x: 150, y: 100, text: "ESTACIÓN TREN SUPERIOR Y CORE (10 MIN)", color: "#1e293b" }
      ]
    }
  };
}

async function main() {
  console.log("═════════════════════════════════════════════════════════════");
  console.log("  PROCESADOR COMPLETO Y ONTOLÓGICO - SESIÓN 2 (SD ALMAZÁN)");
  console.log("═════════════════════════════════════════════════════════════\n");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: dbPlayers } = await supabase.from("players").select("id");
  const validPlayerIds = new Set(dbPlayers?.map(p => p.id));

  // 1. Detección Ontológica de Objetivos de la Sesión
  const rawFisico = "RESISTENCIA";
  const rawTactico = "CONSERVACIÓN DE BALÓN + ACTIVACIÓN PARA PRESIÓN TRAS PÉRDIDA";
  const ontology = parseSessionOntology(rawFisico, rawTactico);

  console.log("🧠 Ontología Detectada:");
  console.log("   - Objetivos Físicos:", ontology.physical_objectives);
  console.log("   - Objetivos Tácticos:", ontology.tactical_objectives);
  console.log("   - Claves Conceptos Tácticos:", ontology.tactical_concept_keys);
  console.log("   - Claves Grupos Musculares / Físicos:", ontology.muscle_group_keys);

  // 2. Localizar Sesión #2 por Número Absoluto en ID 853d22a8-1362-436c-b3e0-1f94627e8b6b
  const sessionId = "853d22a8-1362-436c-b3e0-1f94627e8b6b";
  const sessionDate = "2026-07-28"; // Fecha original de Sesión #2 en el calendario consecutivo

  // Bloque 0: Previo a Entreno y Bloque 1: Calentamiento
  const previoEntrenoNote = "PREVIO ENTRENO (15 min): PROTOCOLO DE TREN SUPERIOR Y CORE (19:15 - 19:30)";
  const calentamientoNote = "CALENTAMIENTO (15 min): CARRERA CONTINUA PARQUE DE LA ARBOLEDA, MOVILIDAD ARTICULAR, ACTIVACIÓN GENERAL (10 min), ACTIVACIÓN ESPECÍFICO (5 min)";
  const observacionesFull = `${sessionData.observaciones}\n\n📌 ${previoEntrenoNote}\n🔥 ${calentamientoNote}`;

  // 3. Crear / Actualizar Tareas en la biblioteca personal de Pablo Ayuso
  console.log("\n📚 Procesando Tareas con Nombres Limpios y Consignas Tácticas...");
  const sessionExercisesData: any[] = [];

  for (let idx = 0; idx < sessionData.tasks.length; idx++) {
    const t = sessionData.tasks[idx];
    const cleanedTitle = cleanTaskTitle(t.title || t.num);
    const category = t.num === "TAREA 4" ? "activacion" : t.num === "TAREA 3" ? "progresion" : "posesion";
    const wb = generateWhiteboardData(t.num);

    // Formatear normas/consignas completas + equipos asignados
    let fullDescription = "";
    if (t.description) fullDescription += `📋 Consignas / Normas: ${t.description}\n\n`;
    if (t.equipos) fullDescription += `👥 Distribución de Equipos:\n${t.equipos}\n\n`;
    fullDescription += `⏱️ Series: ${t.num_series} | Duración por serie: ${t.tiempo_serie} min | Pausa: ${t.tiempo_pausa} min | Total: ${t.tiempo_total} min`;

    // Buscar o insertar en la biblioteca de Pablo Ayuso
    const { data: existingEx } = await supabase
      .from("exercises")
      .select("id")
      .eq("organization_id", ALMAZAN_ORG_ID)
      .eq("created_by", PABLO_AYUSO_ID)
      .eq("title", cleanedTitle)
      .maybeSingle();

    let exerciseId = existingEx?.id;

    if (exerciseId) {
      console.log(`   - Tarea "${cleanedTitle}" actualizada en la biblioteca de Pablo Ayuso [ID: ${exerciseId}].`);
      await supabase
        .from("exercises")
        .update({
          description: fullDescription,
          category: category,
          whiteboard_data: wb.whiteboard_data,
          whiteboard_zone: wb.zone,
          space_dimensions: wb.space_dimensions,
          tactical_concepts: ontology.tactical_concept_keys,
          muscle_groups: ontology.muscle_group_keys
        })
        .eq("id", exerciseId);
    } else {
      console.log(`   + Creando nueva tarea "${cleanedTitle}" en la biblioteca de Pablo Ayuso...`);
      const { data: newEx, error: exErr } = await supabase
        .from("exercises")
        .insert({
          organization_id: ALMAZAN_ORG_ID,
          created_by: PABLO_AYUSO_ID,
          library_scope: "coach",
          is_shared: true,
          title: cleanedTitle,
          description: fullDescription,
          category: category,
          tags: ["almazan", "sesion2", "pretemporada"],
          whiteboard_data: wb.whiteboard_data,
          whiteboard_zone: wb.zone,
          space_dimensions: wb.space_dimensions,
          tactical_concepts: ontology.tactical_concept_keys,
          muscle_groups: ontology.muscle_group_keys,
          needs_groups: Boolean(t.equipos),
          num_groups: t.num === "TAREA 2" ? 3 : t.num === "TAREA 1" ? 2 : 1
        })
        .select("id")
        .single();

      if (exErr || !newEx) {
        console.error(`❌ Error creando ejercicio "${cleanedTitle}":`, exErr?.message);
        continue;
      }
      exerciseId = newEx.id;
    }

    sessionExercisesData.push({
      organization_id: ALMAZAN_ORG_ID,
      session_id: sessionId,
      exercise_id: exerciseId,
      order_index: idx + 1,
      duration_min: t.tiempo_total || 15,
      recovery_min: t.tiempo_pausa || 3,
      space_dimensions: wb.space_dimensions,
      whiteboard_data: wb.whiteboard_data,
      whiteboard_zone: wb.zone,
      tactical_concepts: ontology.tactical_concept_keys,
      muscle_groups: ontology.muscle_group_keys
    });
  }

  // 4. Actualizar la Cabecera de la Sesión
  console.log("\n📝 Actualizando la Sesión #2 con Ontología y Bloques 0 & 1...");
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
      notes: observacionesFull,
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

  // 5. Asistencia de Jugadores (`session_attendance`)
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

  // 6. Vincular Ejercicios a la Sesión (`session_exercises`)
  console.log("\n🎨 Vinculando las 4 tareas con sus pizarras vectoriales...");
  await supabase.from("session_exercises").delete().eq("session_id", sessionId);
  await supabase.from("session_exercises").insert(sessionExercisesData);

  // 7. Recalcular métricas
  console.log("\n📊 Recalculando métricas de sesión para el equipo...");
  await recalculateAndSaveSessionMetrics(ALMAZAN_TEAM_ID, supabase);

  console.log("\n✨ ¡PROCESO COMPLETADO Y PERFECCIONADO! ✨");
}

main().catch(console.error);
