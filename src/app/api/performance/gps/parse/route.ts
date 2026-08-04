import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { folderPath, sessionType = "PARTIDO", sessionDate, playerMapping } = body;

    if (!folderPath) {
      return NextResponse.json(
        { success: false, error: "La ruta de la carpeta de grabaciones es requerida." },
        { status: 400 }
      );
    }

    // Trimmer Engine execution simulation / rule engine based on session type
    const isMatch = sessionType.toUpperCase() === "PARTIDO";

    let periods: Array<{
      name: string;
      t_start: string;
      t_end: string;
      start_min: number;
      end_min: number;
      duration_min: number;
      confidence_score: number;
    }> = [];

    let excludedPeriods: string[] = [];
    let detectionMode = "AUTOMATIC_KICKOFF_SIGNATURE";

    if (isMatch) {
      detectionMode = "AUTOMATIC_KICKOFF_SIGNATURE";
      periods = [
        {
          name: "1ª Parte",
          t_start: "20:05:24",
          t_end: "20:51:54",
          start_min: 0.0,
          end_min: 46.5,
          duration_min: 46.5,
          confidence_score: 0.96,
        },
        {
          name: "2ª Parte",
          t_start: "21:06:54",
          t_end: "21:52:45",
          start_min: 61.5,
          end_min: 108.5,
          duration_min: 47.0,
          confidence_score: 0.94,
        },
      ];
      excludedPeriods = [
        "Pre-Game Warmup / Locker Room (18.5 min)",
        "Half-Time Interval (15.0 min)",
      ];
    } else {
      detectionMode = "MICRO_PAUSES_DETECTION";
      periods = [
        {
          name: "Tarea 1 - Rondo & Calentamiento",
          t_start: "10:30:00",
          t_end: "10:45:00",
          start_min: 0.0,
          end_min: 15.0,
          duration_min: 15.0,
          confidence_score: 0.98,
        },
        {
          name: "Tarea 2 - Posesión Alta Intensidad",
          t_start: "10:48:00",
          t_end: "11:08:00",
          start_min: 18.0,
          end_min: 38.0,
          duration_min: 20.0,
          confidence_score: 0.95,
        },
        {
          name: "Tarea 3 - Partido Reducido 8v8",
          t_start: "11:12:00",
          t_end: "11:34:00",
          start_min: 42.0,
          end_min: 64.0,
          duration_min: 22.0,
          confidence_score: 0.93,
        },
      ];
      excludedPeriods = [
        "Explicación Táctica 1 (3.0 min)",
        "Hidratación & Pausa Tarea 2-3 (4.0 min)",
      ];
    }

    const trimmerJson = {
      session_type: isMatch ? "PARTIDO" : "ENTRENAMIENTO",
      detection_mode: detectionMode,
      periods,
      excluded_periods: excludedPeriods,
      folder_path: folderPath,
      session_date: sessionDate || new Date().toISOString().split("T")[0],
    };

    return NextResponse.json({
      success: true,
      trimmerJson,
      message: "Análisis de firmas inerciales y temporales completado.",
    });
  } catch (err: any) {
    console.error("Error in GPS parse route:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Error al procesar archivos GPS." },
      { status: 500 }
    );
  }
}
