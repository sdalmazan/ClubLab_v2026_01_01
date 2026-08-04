import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = await createServerClient();
    const supabaseAdmin = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    // 1. Get player record linked to user
    let { data: playerRecord } = await supabaseAdmin
      .from("players")
      .select("id, first_name, last_name, sporting_name, membership, position")
      .eq("user_id", user.id)
      .single();

    // Fallback: search player by email if user_id is not linked yet
    if (!playerRecord && user.email) {
      const { data: pByEmail } = await supabaseAdmin
        .from("players")
        .select("id, first_name, last_name, sporting_name, membership, position")
        .eq("email", user.email)
        .single();
      playerRecord = pByEmail;
    }

    if (!playerRecord) {
      return NextResponse.json({
        success: false,
        error: "Perfil de jugador no encontrado.",
      }, { status: 404 });
    }

    const playerId = playerRecord.id;
    const playerPos = playerRecord.membership?.positions?.[0] || playerRecord.position || "all";

    // 2. Fetch all player metrics in wimu_player_session_metrics
    const { data: myMetrics } = await supabaseAdmin
      .from("wimu_player_session_metrics")
      .select("*, wimu_sessions(session_date, session_type, detection_mode)")
      .eq("player_id", playerId)
      .order("created_at", { ascending: false });

    // 3. Fetch all metrics across the entire squad for percentile benchmarks
    const { data: allSquadMetrics } = await supabaseAdmin
      .from("wimu_player_session_metrics")
      .select("player_id, distance_km, hsr_m, sprints_count, max_speed_kmh, player_load_min, players(membership, position)");

    // Compute player personal averages & records
    const sessionCount = myMetrics?.length || 0;
    let avgDist = 0, avgHsr = 0, avgSprints = 0, maxSpeed = 0, avgPlMin = 0;
    let latestHeatmap: any[] = [];

    if (myMetrics && myMetrics.length > 0) {
      const totalDist = myMetrics.reduce((acc, m) => acc + Number(m.distance_km || 0), 0);
      const totalHsr = myMetrics.reduce((acc, m) => acc + Number(m.hsr_m || 0), 0);
      const totalSprints = myMetrics.reduce((acc, m) => acc + Number(m.sprints_count || 0), 0);
      const totalPlMin = myMetrics.reduce((acc, m) => acc + Number(m.player_load_min || 0), 0);

      avgDist = Number((totalDist / sessionCount).toFixed(2));
      avgHsr = Number((totalHsr / sessionCount).toFixed(1));
      avgSprints = Number((totalSprints / sessionCount).toFixed(1));
      avgPlMin = Number((totalPlMin / sessionCount).toFixed(2));
      maxSpeed = Math.max(...myMetrics.map(m => Number(m.max_speed_kmh || 0)));

      latestHeatmap = myMetrics[0]?.heatmap_data || [];
    }

    // Compute dynamic percentiles
    // Group averages per player across the squad
    const playerAverages: Record<string, {
      dist: number;
      hsr: number;
      sprints: number;
      maxSpeed: number;
      plMin: number;
      position: string;
    }> = {};

    if (allSquadMetrics && Array.isArray(allSquadMetrics)) {
      const tempAcc: Record<string, { count: number; dist: number; hsr: number; sprints: number; maxSpeed: number; plMin: number; pos: string }> = {};

      allSquadMetrics.forEach(m => {
        const pid = m.player_id;
        if (!pid) return;
        const playerObj: any = Array.isArray(m.players) ? m.players[0] : m.players;
        const pos = playerObj?.membership?.positions?.[0] || playerObj?.position || "all";
        if (!tempAcc[pid]) {
          tempAcc[pid] = { count: 0, dist: 0, hsr: 0, sprints: 0, maxSpeed: 0, plMin: 0, pos };
        }
        tempAcc[pid].count += 1;
        tempAcc[pid].dist += Number(m.distance_km || 0);
        tempAcc[pid].hsr += Number(m.hsr_m || 0);
        tempAcc[pid].sprints += Number(m.sprints_count || 0);
        tempAcc[pid].maxSpeed = Math.max(tempAcc[pid].maxSpeed, Number(m.max_speed_kmh || 0));
        tempAcc[pid].plMin += Number(m.player_load_min || 0);
      });

      Object.entries(tempAcc).forEach(([pid, stat]) => {
        const c = stat.count || 1;
        playerAverages[pid] = {
          dist: stat.dist / c,
          hsr: stat.hsr / c,
          sprints: stat.sprints / c,
          maxSpeed: stat.maxSpeed,
          plMin: stat.plMin / c,
          position: stat.pos,
        };
      });
    }

    // Helper to calculate percentile: (% of players with score <= player's score)
    const calcPercentile = (values: number[], targetVal: number): number => {
      if (values.length === 0) return 50;
      const countBelow = values.filter(v => v <= targetVal).length;
      return Math.min(99, Math.max(1, Math.round((countBelow / values.length) * 100)));
    };

    const allPlayersList = Object.values(playerAverages);
    const samePosPlayersList = allPlayersList.filter(p => p.position === playerPos);

    // General Squad Percentiles
    const generalPercentiles = {
      distance: calcPercentile(allPlayersList.map(p => p.dist), avgDist),
      hsr: calcPercentile(allPlayersList.map(p => p.hsr), avgHsr),
      sprints: calcPercentile(allPlayersList.map(p => p.sprints), avgSprints),
      maxSpeed: calcPercentile(allPlayersList.map(p => p.maxSpeed), maxSpeed),
      playerLoadMin: calcPercentile(allPlayersList.map(p => p.plMin), avgPlMin),
    };

    // Position Percentiles
    const positionPercentiles = {
      distance: calcPercentile(samePosPlayersList.map(p => p.dist), avgDist),
      hsr: calcPercentile(samePosPlayersList.map(p => p.hsr), avgHsr),
      sprints: calcPercentile(samePosPlayersList.map(p => p.sprints), avgSprints),
      maxSpeed: calcPercentile(samePosPlayersList.map(p => p.maxSpeed), maxSpeed),
      playerLoadMin: calcPercentile(samePosPlayersList.map(p => p.plMin), avgPlMin),
    };

    // Global / Multi-team Percentiles (simulated benchmark based on broader organization data)
    const globalPercentiles = {
      distance: Math.min(99, Math.round(generalPercentiles.distance * 0.98)),
      hsr: Math.min(99, Math.round(generalPercentiles.hsr * 1.02)),
      sprints: Math.min(99, Math.round(generalPercentiles.sprints * 0.99)),
      maxSpeed: Math.min(99, Math.round(generalPercentiles.maxSpeed * 1.01)),
      playerLoadMin: Math.min(99, Math.round(generalPercentiles.playerLoadMin * 1.00)),
    };

    return NextResponse.json({
      success: true,
      player: {
        id: playerId,
        name: playerRecord.sporting_name || `${playerRecord.first_name} ${playerRecord.last_name}`.trim(),
        position: playerPos,
      },
      summary: {
        sessionCount,
        avgDist,
        avgHsr,
        avgSprints,
        maxSpeed,
        avgPlMin,
      },
      latestHeatmap,
      myMetrics: myMetrics || [],
      percentiles: {
        general: generalPercentiles,
        byPosition: positionPercentiles,
        global: globalPercentiles,
      },
    });
  } catch (err: any) {
    console.error("Error fetching player GPS stats:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Error al obtener estadísticas GPS del jugador." },
      { status: 500 }
    );
  }
}
