import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/performance/gps/upload-processed
 *
 * Endpoint consumed by the local WIMU GPS Python agent.
 * Authenticates via api_token, resolves organization_id,
 * and inserts session + trimmed periods + player metrics.
 */

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      api_token,
      session_date,
      session_type,
      folder_path,
      trimmer,
      player_metrics,
    } = body;

    if (!api_token) {
      return NextResponse.json(
        { success: false, error: "api_token requerido." },
        { status: 401 }
      );
    }

    const supabase = createAdminClient();

    // ── Validate token and get organization_id ─────────────────
    const { data: tokenRecord, error: tokenErr } = await supabase
      .from("organization_api_tokens")
      .select("organization_id")
      .eq("token", api_token)
      .maybeSingle();

    if (tokenErr || !tokenRecord) {
      return NextResponse.json(
        { success: false, error: "Token no válido o revocado." },
        { status: 403 }
      );
    }

    const organizationId = tokenRecord.organization_id;

    // ── 1. Insert wimu_session ─────────────────────────────────
    const { data: sessionData, error: sessionErr } = await supabase
      .from("wimu_sessions")
      .insert({
        organization_id: organizationId,
        session_date:    session_date || new Date().toISOString().split("T")[0],
        session_type:    session_type || "PARTIDO",
        detection_mode:  trimmer?.detection_mode || "AUTOMATIC_KICKOFF_SIGNATURE",
        folder_path:     folder_path || "",
        notes:           `Importación automática vía Agente GPS Local`,
      })
      .select()
      .single();

    if (sessionErr) throw sessionErr;
    const sessionId = sessionData.id;

    // ── 2. Insert trimmed periods ──────────────────────────────
    const periods = trimmer?.periods || [];
    if (periods.length > 0) {
      const periodsToInsert = periods.map((p: any) => ({
        session_id:       sessionId,
        period_name:      p.name,
        t_start:          p.t_start,
        t_end:            p.t_end,
        start_min:        p.start_min ?? 0,
        end_min:          p.end_min ?? 0,
        duration_min:     p.duration_min ?? 0,
        confidence_score: p.confidence_score ?? 0.95,
      }));

      const { error: pErr } = await supabase
        .from("session_trimmed_periods")
        .insert(periodsToInsert);

      if (pErr) {
        console.error("Error inserting trimmed periods:", pErr);
        // Non-fatal: continue saving metrics
      }
    }

    // ── 3. Insert player metrics ───────────────────────────────
    const metrics: any[] = player_metrics || [];
    let metricsCount = 0;

    if (metrics.length > 0) {
      const metricsToInsert = metrics
        .filter((m) => !!m.player_id)
        .map((m) => ({
          session_id:       sessionId,
          player_id:        m.player_id,
          distance_km:      m.distance_km ?? 0,
          hsr_m:            m.hsr_m ?? 0,
          sprints_count:    m.sprints_count ?? 0,
          max_speed_kmh:    m.max_speed_kmh ?? 0,
          player_load:      m.player_load ?? 0,
          player_load_min:  m.player_load_min ?? 0,
          accelerations:    m.accelerations ?? 0,
          decelerations:    m.decelerations ?? 0,
          heatmap_data:     m.heatmap_data ?? [],
        }));

      const { error: mErr } = await supabase
        .from("wimu_player_session_metrics")
        .insert(metricsToInsert);

      if (mErr) throw mErr;
      metricsCount = metricsToInsert.length;
    }

    return NextResponse.json({
      success:      true,
      sessionId,
      metricsCount,
      periodsCount: periods.length,
      message:      `Sesión GPS guardada. ${metricsCount} jugadores procesados.`,
    });
  } catch (err: any) {
    console.error("Error in upload-processed GPS route:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Error al guardar sesión GPS." },
      { status: 500 }
    );
  }
}
