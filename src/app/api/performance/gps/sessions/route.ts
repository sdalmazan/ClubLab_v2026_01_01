import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";

/**
 * GET  /api/performance/gps/sessions           — list sessions (org-scoped)
 * GET  /api/performance/gps/sessions?sessionId= — single session detail
 * POST /api/performance/gps/sessions            — save session from modal (org-scoped)
 */

async function getOrgId(supabase: any, userId: string): Promise<string | null> {
  const { data: roleRow } = await supabase
    .from("user_organization_roles")
    .select("organization_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (roleRow?.organization_id) return roleRow.organization_id;

  // Fallback 1: check organization_invitations
  const { data: invRow } = await supabase
    .from("organization_invitations")
    .select("organization_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (invRow?.organization_id) return invRow.organization_id;

  // Fallback 2: first available organization
  const { data: firstOrg } = await supabase
    .from("organizations")
    .select("id")
    .limit(1)
    .maybeSingle();

  return firstOrg?.id ?? null;
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
        .eq("organization_id", orgId)
        .single();

      if (sErr) throw sErr;

      let isFriendly = false;
      let linkedTitle = session.notes || null;

      if (session.session_date) {
        const { data: tMatch } = await supabase
          .from("training_sessions")
          .select("title, session_type, is_friendly")
          .eq("session_date", session.session_date)
          .maybeSingle();

        const { data: mMatch } = await supabase
          .from("matches")
          .select("opponent, is_friendly, match_type")
          .eq("date", session.session_date)
          .maybeSingle();

        if (tMatch?.title) linkedTitle = tMatch.title;
        else if (mMatch?.opponent) linkedTitle = `vs ${mMatch.opponent}`;

        const normText = ((session.notes || "") + " " + (linkedTitle || "")).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        isFriendly = Boolean(
          tMatch?.is_friendly ||
          mMatch?.is_friendly ||
          mMatch?.match_type === "FRIENDLY" ||
          normText.includes("amistoso") ||
          normText.includes("siguenza") ||
          normText.includes("pretemporada") ||
          normText.includes("ensayo")
        );
      }

      const sessionWithFriendly = {
        ...session,
        linked_title: linkedTitle,
        is_friendly: isFriendly,
      };

      const { data: periods } = await supabase
        .from("session_trimmed_periods")
        .select("*")
        .eq("session_id", sessionId)
        .order("start_min", { ascending: true });

      const { data: rawMetrics } = await supabase
        .from("wimu_player_session_metrics")
        .select("*, players(id, first_name, last_name, sporting_name, jersey_number, position)")
        .eq("session_id", sessionId);

      let metrics: any[] = rawMetrics || [];

      if (metrics.length > 0) {
        const { data: playersList } = await supabase
          .from("players")
          .select("id, first_name, last_name, sporting_name, jersey_number, position, player_team_memberships(jersey_number)")
          .eq("organization_id", orgId);

        const pMap = new Map((playersList || []).map((p: any) => {
          const resolvedJersey = p.jersey_number ?? p.player_team_memberships?.[0]?.jersey_number ?? null;
          return [p.id, { ...p, jersey_number: resolvedJersey }];
        }));

        metrics = metrics.map((m: any) => {
          const matchedPlayer = m.players || pMap.get(m.player_id) || null;
          return {
            ...m,
            players: matchedPlayer,
          };
        });
      }

      return NextResponse.json({
        success: true,
        session: sessionWithFriendly,
        periods: periods || [],
        metrics,
      });
    }

    // ── All sessions (org-scoped) ──────────────────────────────
    const { data: rawSessions, error: fetchErr } = await supabase
      .from("wimu_sessions")
      .select("*")
      .eq("organization_id", orgId)
      .order("session_date", { ascending: false });

    if (fetchErr) throw fetchErr;

    let sessions = rawSessions || [];

    // Cross-reference with training_sessions & matches to get titles & friendly flags
    const dates = sessions.map((s: any) => s.session_date).filter(Boolean);
    if (dates.length > 0) {
      const { data: tSessions } = await supabase
        .from("training_sessions")
        .select("session_date, title, session_type, is_friendly")
        .in("session_date", dates);

      const { data: mMatches } = await supabase
        .from("matches")
        .select("date, opponent, is_friendly, match_type")
        .in("date", dates);

      const tMap = new Map((tSessions || []).map((t: any) => [t.session_date, t]));
      const mMap = new Map((mMatches || []).map((m: any) => [m.date, m]));

      sessions = sessions.map((s: any) => {
        const tMatch = tMap.get(s.session_date);
        const mMatch = mMap.get(s.session_date);

        const linkedTitle = tMatch?.title || mMatch?.opponent ? `vs ${mMatch.opponent}` : null;
        const isFriendly = Boolean(
          tMatch?.is_friendly ||
          mMatch?.is_friendly ||
          mMatch?.match_type === "FRIENDLY" ||
          (tMatch?.title && (tMatch.title.toLowerCase().includes("amistoso") || tMatch.title.toLowerCase().includes("sigüenza") || tMatch.title.toLowerCase().includes("siguenza"))) ||
          (s.notes && (s.notes.toLowerCase().includes("amistoso") || s.notes.toLowerCase().includes("sigüenza") || s.notes.toLowerCase().includes("siguenza")))
        );

        return {
          ...s,
          linked_title: linkedTitle || s.notes,
          is_friendly: isFriendly,
        };
      });
    }

    // ── Season averages (org-scoped only) ──────────────────────
    // Get all session IDs for this org first, then filter metrics
    const sessionIds = (sessions || []).map((s: any) => s.id);

    let playerSeasonStats: Record<string, any> = {};

    if (sessionIds.length > 0) {
      const { data: allMetrics } = await supabase
        .from("wimu_player_session_metrics")
        .select("session_id, player_id, distance_km, hsr_m, sprints_count, max_speed_kmh, player_load_min, accelerations, hmld_m, metabolic_power_wkg, acwr_ratio, explosive_distance_m")
        .in("session_id", sessionIds);

      const sessionMetricsCount: Record<string, number> = {};

      if (allMetrics && Array.isArray(allMetrics)) {
        const acc: Record<string, {
          count: number; dist: number; hsr: number; sprints: number;
          maxSpeed: number; plMin: number; accel: number;
          hmld: number; metPower: number; acwr: number; expDist: number;
        }> = {};

        allMetrics.forEach((m) => {
          if (m.session_id) {
            sessionMetricsCount[m.session_id] = (sessionMetricsCount[m.session_id] || 0) + 1;
          }
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

        sessions = sessions.map((s: any) => ({
          ...s,
          metrics_count: sessionMetricsCount[s.id] || 0,
        }));
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

    const targetDate = sessionDate || new Date().toISOString().split("T")[0];
    let matchId: string | null = null;
    let finalNotes = notes || "";

    // Auto-link match on the specified date
    const { data: matchRecord } = await supabase
      .from("matches")
      .select("id, match_opponent")
      .eq("organization_id", orgId)
      .eq("match_date", targetDate)
      .maybeSingle();

    if (matchRecord) {
      matchId = matchRecord.id;
      const opp = matchRecord.match_opponent || "Rival";
      if (!finalNotes.includes(opp)) {
        finalNotes = finalNotes ? `${finalNotes} · Vinculado a Partido vs ${opp}` : `Partido vs ${opp}`;
      }
    }

    // Limpiar sesiones vacías huérfanas (sin métricas) en la misma fecha antes de crear la nueva
    const { data: emptySessions } = await supabase
      .from("wimu_sessions")
      .select("id")
      .eq("organization_id", orgId)
      .eq("session_date", targetDate);

    if (emptySessions && emptySessions.length > 0) {
      for (const es of emptySessions) {
        const { count } = await supabase
          .from("wimu_player_session_metrics")
          .select("id", { count: "exact", head: true })
          .eq("session_id", es.id);
        
        if (count === 0 || count === null) {
          await supabase.from("session_trimmed_periods").delete().eq("session_id", es.id);
          await supabase.from("wimu_sessions").delete().eq("id", es.id);
        }
      }
    }

    // ── 1. Insert session ──────────────────────────────────────
    let sessionData: any = null;
    let sessionErr: any = null;

    // Try insert with match_id
    const res1 = await supabase
      .from("wimu_sessions")
      .insert({
        organization_id: orgId,
        match_id:        matchId,
        session_date:    targetDate,
        session_type:    sessionType || "PARTIDO",
        detection_mode:  detectionMode || "AUTOMATIC_KICKOFF_SIGNATURE",
        folder_path:     folderPath || "",
        notes:           finalNotes,
      })
      .select()
      .single();

    sessionData = res1.data;
    sessionErr = res1.error;

    // Fallback if match_id column does not exist on target DB
    if (sessionErr && (sessionErr.code === "42703" || sessionErr.message?.includes("match_id"))) {
      const resFallback = await supabase
        .from("wimu_sessions")
        .insert({
          organization_id: orgId,
          session_date:    targetDate,
          session_type:    sessionType || "PARTIDO",
          detection_mode:  detectionMode || "AUTOMATIC_KICKOFF_SIGNATURE",
          folder_path:     folderPath || "",
          notes:           finalNotes,
        })
        .select()
        .single();
      sessionData = resFallback.data;
      sessionErr = resFallback.error;
    }

    function safeNum(val: any, fallback = 0, minVal?: number, maxVal?: number): number {
      if (val === null || val === undefined) return fallback;
      const num = Number(val);
      if (!Number.isFinite(num) || Number.isNaN(num)) return fallback;
      let res = num;
      if (minVal !== undefined && res < minVal) res = minVal;
      if (maxVal !== undefined && res > maxVal) res = maxVal;
      return Math.round(res * 1000) / 1000;
    }

    if (sessionErr) throw new Error(`Error creando la sesión: ${sessionErr.message || JSON.stringify(sessionErr)}`);
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
        console.warn("Could not insert trimmed periods:", pErr.message);
      }
    }

    // ── 3. Insert player metrics ───────────────────────────────
    if (Array.isArray(playerMetrics) && playerMetrics.length > 0) {
      const buildMetricObj = (m: any, includeSubstitutions = true) => {
        const obj: any = {
          session_id:             sessionId,
          player_id:              m.player_id,
          gps_device_number:      m.gps_device_number || m.devNum || null,
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
          player_load:            safeNum(m.player_load, 0, 0, 500),
          player_load_min:        safeNum(m.player_load_min, 1.15, 0, 15),
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
          // Spatial Assets
          heatmap_data:           m.heatmap_data ?? [],
          sprint_vectors:         m.sprint_vectors ?? [],
        };

        if (includeSubstitutions) {
          obj.player_start_min = m.player_start_min != null ? safeNum(m.player_start_min, 0, 0, 999) : null;
          obj.player_end_min   = m.player_end_min != null ? safeNum(m.player_end_min, 0, 0, 999) : null;
          obj.played_minutes   = m.played_minutes != null ? safeNum(m.played_minutes, 0, 0, 999) : null;
        }

        return obj;
      };

      const metricsToInsert = playerMetrics
        .filter((m: any) => !!m.player_id)
        .map((m: any) => buildMetricObj(m, true));

      const { error: mErr } = await supabase
        .from("wimu_player_session_metrics")
        .insert(metricsToInsert);

      // Fallback if substitution columns do not exist on DB
      if (mErr) {
        console.warn("Retrying player metrics insert without substitution columns:", mErr.message);
        const fallbackMetrics = playerMetrics
          .filter((m: any) => !!m.player_id)
          .map((m: any) => buildMetricObj(m, false));

        const { error: mErrFallback } = await supabase
          .from("wimu_player_session_metrics")
          .insert(fallbackMetrics);

        if (mErrFallback) throw new Error(`Error guardando métricas de jugadores: ${mErrFallback.message}`);
      }
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

export async function DELETE(req: Request) {
  try {
    const serverClient = await createServerClient();
    const { data: { user } } = await serverClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }

    const orgId = await getOrgId(serverClient, user.id);
    if (!orgId) {
      return NextResponse.json({ success: false, error: "Organización no encontrada" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    if (!sessionId) {
      return NextResponse.json({ success: false, error: "sessionId es requerido" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Delete metrics and periods
    await supabase.from("wimu_player_session_metrics").delete().eq("session_id", sessionId);
    await supabase.from("session_trimmed_periods").delete().eq("session_id", sessionId);

    // Delete session
    const { error: dErr } = await supabase
      .from("wimu_sessions")
      .delete()
      .eq("id", sessionId)
      .eq("organization_id", orgId);

    if (dErr) throw dErr;

    return NextResponse.json({ success: true, message: "Sesión GPS eliminada correctamente." });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Error al eliminar sesión GPS." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const serverClient = await createServerClient();
    const { data: { user } } = await serverClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }

    const orgId = await getOrgId(serverClient, user.id);
    if (!orgId) {
      return NextResponse.json({ success: false, error: "Organización no encontrada" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    if (!sessionId) {
      return NextResponse.json({ success: false, error: "sessionId es requerido" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const body = await req.json();
    const { session_date, session_type, notes, is_friendly } = body;

    const updates: Record<string, any> = {};
    if (session_date) updates.session_date = session_date;
    if (session_type) updates.session_type = session_type;
    if (notes !== undefined) updates.notes = notes;

    if (is_friendly !== undefined) {
      let curNotes = notes ?? updates.notes ?? "";
      if (is_friendly) {
        if (!curNotes.toLowerCase().includes("amistoso")) {
          curNotes = `Amistoso ${curNotes}`.trim();
        }
      } else {
        curNotes = curNotes.replace(/amistoso/gi, "").replace(/friendly/gi, "").replace(/pretemporada/gi, "").trim();
      }
      updates.notes = curNotes;
    }

    const { data: updated, error: uErr } = await supabase
      .from("wimu_sessions")
      .update(updates)
      .eq("id", sessionId)
      .eq("organization_id", orgId)
      .select()
      .single();

    if (uErr) throw uErr;

    return NextResponse.json({ success: true, session: { ...updated, is_friendly: is_friendly ?? false } });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Error al actualizar sesión." }, { status: 500 });
  }
}
