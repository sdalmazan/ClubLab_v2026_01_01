import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";

/**
 * GET  /api/performance/gps/sessions           — list sessions (org-scoped)
 * GET  /api/performance/gps/sessions?sessionId= — single session detail
 * POST /api/performance/gps/sessions            — save session from modal (org-scoped)
 */

async function getOrgId(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("user_organization_roles")
    .select("organization_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.organization_id ?? null;
}

export async function GET(req: Request) {
  try {
    // ── Auth ──────────────────────────────────────────────────
    const serverClient = await createServerClient();
    const { data: { user } } = await serverClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }

    const orgId = await getOrgId(serverClient, user.id);
    if (!orgId) {
      return NextResponse.json({ success: false, error: "Organización no encontrada" }, { status: 404 });
    }

    const supabase = createAdminClient();
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    // ── Single session detail ──────────────────────────────────
    if (sessionId) {
      const { data: session, error: sErr } = await supabase
        .from("wimu_sessions")
        .select("*")
        .eq("id", sessionId)
        .eq("organization_id", orgId) // ensure org isolation
        .single();

      if (sErr) throw sErr;

      const { data: periods } = await supabase
        .from("session_trimmed_periods")
        .select("*")
        .eq("session_id", sessionId)
        .order("start_min", { ascending: true });

      const { data: metrics } = await supabase
        .from("wimu_player_session_metrics")
        .select("*, players(id, first_name, last_name, sporting_name, jersey_number, membership)")
        .eq("session_id", sessionId);

      return NextResponse.json({
        success: true,
        session,
        periods:  periods || [],
        metrics:  metrics || [],
      });
    }

    // ── All sessions (org-scoped) ──────────────────────────────
    const { data: sessions, error: fetchErr } = await supabase
      .from("wimu_sessions")
      .select("*")
      .eq("organization_id", orgId)
      .order("session_date", { ascending: false });

    if (fetchErr) throw fetchErr;

    // ── Season averages (org-scoped only) ──────────────────────
    // Get all session IDs for this org first, then filter metrics
    const sessionIds = (sessions || []).map((s: any) => s.id);

    let playerSeasonStats: Record<string, any> = {};

    if (sessionIds.length > 0) {
      const { data: allMetrics } = await supabase
        .from("wimu_player_session_metrics")
        .select("player_id, distance_km, hsr_m, sprints_count, max_speed_kmh, player_load_min, accelerations, hmld_m, metabolic_power_wkg, acwr_ratio, explosive_distance_m")
        .in("session_id", sessionIds);

      if (allMetrics && Array.isArray(allMetrics)) {
        const acc: Record<string, {
          count: number; dist: number; hsr: number; sprints: number;
          maxSpeed: number; plMin: number; accel: number;
          hmld: number; metPower: number; acwr: number; expDist: number;
        }> = {};

        allMetrics.forEach((m) => {
          const pid = m.player_id;
          if (!pid) return;
          if (!acc[pid]) acc[pid] = { count: 0, dist: 0, hsr: 0, sprints: 0, maxSpeed: 0, plMin: 0, accel: 0, hmld: 0, metPower: 0, acwr: 0, expDist: 0 };
          acc[pid].count  += 1;
          acc[pid].dist   += Number(m.distance_km || 0);
          acc[pid].hsr    += Number(m.hsr_m || 0);
          acc[pid].sprints += Number(m.sprints_count || 0);
          acc[pid].maxSpeed = Math.max(acc[pid].maxSpeed, Number(m.max_speed_kmh || 0));
          acc[pid].plMin  += Number(m.player_load_min || 0);
          acc[pid].accel  += Number(m.accelerations || 0);
          acc[pid].hmld   += Number(m.hmld_m || 0);
          acc[pid].metPower += Number(m.metabolic_power_wkg || 0);
          acc[pid].acwr   += Number(m.acwr_ratio || 0);
          acc[pid].expDist += Number(m.explosive_distance_m || 0);
        });

        Object.entries(acc).forEach(([pid, stat]) => {
          const c = stat.count || 1;
          playerSeasonStats[pid] = {
            totalSessions:        c,
            avgDistanceKm:        Number((stat.dist / c).toFixed(2)),
            avgHsrM:              Number((stat.hsr / c).toFixed(1)),
            avgSprints:           Number((stat.sprints / c).toFixed(1)),
            avgMaxSpeedKmh:       Number(stat.maxSpeed.toFixed(1)),
            avgPlayerLoadMin:     Number((stat.plMin / c).toFixed(2)),
            avgAccelerations:     Number((stat.accel / c).toFixed(1)),
            avgHmldM:             Number((stat.hmld / c).toFixed(1)),
            avgMetabolicPowerWkg: Number((stat.metPower / c).toFixed(2)),
            avgAcwrRatio:         Number((stat.acwr / c).toFixed(3)),
            avgExplosiveDistM:    Number((stat.expDist / c).toFixed(1)),
          };
        });
      }
    }

    return NextResponse.json({
      success: true,
      sessions: sessions || [],
      playerSeasonStats,
    });
  } catch (err: any) {
    console.error("Error fetching GPS sessions:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Error al obtener sesiones GPS." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    // ── Auth ──────────────────────────────────────────────────
    const serverClient = await createServerClient();
    const { data: { user } } = await serverClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }

    const orgId = await getOrgId(serverClient, user.id);
    if (!orgId) {
      return NextResponse.json({ success: false, error: "Organización no encontrada" }, { status: 404 });
    }

    const supabase = createAdminClient();
    const body = await req.json();
    const { sessionDate, sessionType, detectionMode, folderPath, notes, periods, playerMetrics } = body;

    // ── 1. Insert session ──────────────────────────────────────
    const { data: sessionData, error: sessionErr } = await supabase
      .from("wimu_sessions")
      .insert({
        organization_id: orgId,
        session_date:    sessionDate || new Date().toISOString().split("T")[0],
        session_type:    sessionType || "PARTIDO",
        detection_mode:  detectionMode || "AUTOMATIC_KICKOFF_SIGNATURE",
        folder_path:     folderPath || "",
        notes:           notes || "",
      })
      .select()
      .single();

function safeNum(val: any, fallback = 0, minVal?: number, maxVal?: number): number {
  if (val === null || val === undefined) return fallback;
  const num = Number(val);
  if (!Number.isFinite(num) || Number.isNaN(num)) return fallback;
  let res = num;
  if (minVal !== undefined && res < minVal) res = minVal;
  if (maxVal !== undefined && res > maxVal) res = maxVal;
  return Math.round(res * 1000) / 1000;
}

    if (sessionErr) throw sessionErr;
    const sessionId = sessionData.id;

    // ── 2. Insert trimmed periods ──────────────────────────────
    if (Array.isArray(periods) && periods.length > 0) {
      const periodsToInsert = periods.map((p: any) => ({
        session_id:       sessionId,
        period_name:      p.name || p.period_name || "Período",
        t_start:          p.t_start || "00:00:00",
        t_end:            p.t_end || "00:00:00",
        start_min:        safeNum(p.start_min, 0, 0, 9999),
        end_min:          safeNum(p.end_min, 0, 0, 9999),
        duration_min:     safeNum(p.duration_min, 0, 0, 9999),
        confidence_score: safeNum(p.confidence_score, 0.95, 0, 1),
      }));

      const { error: pErr } = await supabase
        .from("session_trimmed_periods")
        .insert(periodsToInsert);

      if (pErr) {
        throw new Error(`Error guardando periodos: ${pErr.message}`);
      }
    }

    // ── 3. Insert player metrics ───────────────────────────────
    if (Array.isArray(playerMetrics) && playerMetrics.length > 0) {
      const metricsToInsert = playerMetrics
        .filter((m: any) => !!m.player_id)
        .map((m: any) => ({
          session_id:             sessionId,
          player_id:              m.player_id,
          // Bloque 1: Kinematics
          distance_km:            safeNum(m.distance_km, 0, 0, 999),
          distance_m:             Math.round(safeNum(m.distance_m, 0, 0, 999000)),
          relative_distance_mmin: safeNum(m.relative_distance_mmin, 0, 0, 9999),
          hsr_m:                  safeNum(m.hsr_m, 0, 0, 99999),
          sprints_count:          Math.round(safeNum(m.sprints_count, 0, 0, 999)),
          max_speed_kmh:          safeNum(m.max_speed_kmh, 0, 0, 99),
          speed_bands:            m.speed_bands ?? {},
          // Bloque 2: Acc/Dec & COD
          accelerations:          Math.round(safeNum(m.accelerations, 0, 0, 9999)),
          decelerations:          Math.round(safeNum(m.decelerations, 0, 0, 9999)),
          explosive_distance_m:   safeNum(m.explosive_distance_m, 0, 0, 99999),
          acc_bands:              m.accel_bands ?? {},
          dec_bands:              m.decel_bands ?? {},
          acc_dec_ratio:          safeNum(m.acc_dec_ratio, 0, 0, 99),
          cod_count:              m.codCount ?? {},
          // Bloque 3: Neuromuscular
          player_load:            safeNum(m.player_load, 0, 0, 9999),
          player_load_min:        safeNum(m.player_load_min, 0, 0, 999),
          impacts_count:          m.impacts_count ?? {},
          jumps:                  m.jumps ?? {},
          // Bloque 4: Metabolic Power
          metabolic_power_wkg:    safeNum(m.metabolic_power_wkg, 0, 0, 999),
          hmld_m:                 safeNum(m.hmld_m, 0, 0, 99999),
          equivalent_distance_m:  safeNum(m.equivalentDistanceM ?? m.equivalent_distance_m, 0, 0, 99999),
          total_kcal:             safeNum(m.totalKcal ?? m.total_kcal, 0, 0, 99999),
          // Bloque 5: Biomechanics & Fatigue
          efficiency_ratio_pl_m:  safeNum(m.efficiencyRatioPLm ?? m.efficiency_ratio_pl_m, 0, 0, 99),
          stride_asymmetry_lr:    safeNum(m.strideAsymmetryLR ?? m.stride_asymmetry_lr, 50, 0, 100),
          dynamic_asymmetry_shift:safeNum(m.dynamicAsymmetryShiftPct ?? m.dynamic_asymmetry_shift, 0, -100, 100),
          eccentric_decay_pct:    safeNum(m.eccentricDecayPct ?? m.eccentric_decay_pct, 0, -100, 100),
          // Bloque 6: Worst-Case Scenarios
          worst_case_scenarios:   m.worst_case_scenarios ?? {},
          // Bloque 7: HR Zones
          hr_metrics:             m.hrMetrics ?? {},
          // Bloque 8: ACWR
          acwr_ratio:             safeNum(m.acwr_ratio, 0, 0, 99),
          // Sustituciones / Ventana de juego individual
          player_start_min:       m.player_start_min != null ? safeNum(m.player_start_min, 0, 0, 999) : null,
          player_end_min:         m.player_end_min != null ? safeNum(m.player_end_min, 0, 0, 999) : null,
          played_minutes:         m.played_minutes != null ? safeNum(m.played_minutes, 0, 0, 999) : null,
          // Spatial Assets
          heatmap_data:           m.heatmap_data ?? [],
          sprint_vectors:         m.sprint_vectors ?? [],
        }));

      const { error: mErr } = await supabase
        .from("wimu_player_session_metrics")
        .insert(metricsToInsert);

      if (mErr) throw mErr;
    }

    return NextResponse.json({
      success:  true,
      sessionId,
      message:  "Sesión GPS guardada correctamente.",
    });
  } catch (err: any) {
    console.error("Error saving GPS session:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Error al guardar sesión GPS." },
      { status: 500 }
    );
  }
}
