import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recalculateAndSaveSessionMetrics } from "@/services/sessions";

/**
 * GET /api/training/preseason
 * Fetches all preseason sessions for a specific team.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get("teamId");

  if (!teamId) {
    return NextResponse.json({ error: "Missing teamId parameter" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: sessions, error } = await supabase
      .from("preseason_sessions")
      .select("*")
      .eq("team_id", teamId)
      .order("date", { ascending: true });

    if (error) throw error;

    // Map database snake_case fields back to frontend camelCase fields
    const formatted = (sessions || []).map((s: any) => ({
      id: s.id,
      date: s.date,
      type: s.type,
      startTime: s.start_time ? s.start_time.slice(0, 5) : undefined,
      location: s.location || undefined,
      opponent: s.opponent || undefined,
      fieldType: s.field_type || undefined,
      fieldDimensions: s.field_dimensions || undefined,
      comments: s.comments || undefined,
    }));

    return NextResponse.json(formatted);
  } catch (e: any) {
    console.error("[GET /api/training/preseason] Error:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/**
 * POST /api/training/preseason
 * Synchronizes the list of preseason sessions with Supabase.
 * Automatically inserts/updates/deletes sessions in both `preseason_sessions` and `training_sessions`.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let teamId: any = null;
  let seasonId: any = null;
  let sessions: any[] = [];

  try {
    const { data: orgRole } = await supabase
      .from("user_organization_roles")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!orgRole) {
      return NextResponse.json({ error: "No organization assigned" }, { status: 403 });
    }

    const body = await request.json();
    teamId = body.teamId;
    seasonId = body.seasonId;
    sessions = body.sessions;

    if (!teamId) {
      return NextResponse.json({ error: "Missing teamId in body" }, { status: 400 });
    }

    const currentIds = (sessions || []).map((s: any) => s.id);

    // 1. Fetch existing preseason sessions in DB to find which ones were deleted
    const { data: dbPreseason } = await supabase
      .from("preseason_sessions")
      .select("id")
      .eq("team_id", teamId);

    const dbIds = (dbPreseason || []).map((s: any) => s.id);
    const deletedIds = dbIds.filter((id: string) => !currentIds.includes(id));

    // 2. Perform deletions
    if (deletedIds.length > 0) {
      // Delete from preseason_sessions
      await supabase
        .from("preseason_sessions")
        .delete()
        .in("id", deletedIds);

      // Delete from training_sessions
      await supabase
        .from("training_sessions")
        .delete()
        .in("id", deletedIds);
    }

    if (sessions && sessions.length > 0) {
      // 3. Upsert to preseason_sessions table
      const preseasonUpsert = sessions.map((s: any) => ({
        id: s.id,
        organization_id: orgRole.organization_id,
        team_id: teamId,
        season_id: seasonId || null,
        date: s.date,
        start_time: s.startTime ? `${s.startTime}:00` : null,
        type: s.type,
        opponent: s.opponent || null,
        location: s.location || null,
        field_type: s.fieldType || null,
        field_dimensions: s.fieldDimensions || null,
        comments: s.comments || null,
      }));

      const { error: preseasonError } = await supabase
        .from("preseason_sessions")
        .upsert(preseasonUpsert, { onConflict: "id" });

      if (preseasonError) throw preseasonError;

      // 4. Fetch which training sessions already exist to do selective updates and preserve custom exercises/convocations
      const { data: existingTraining } = await supabase
        .from("training_sessions")
        .select("id")
        .in("id", currentIds);

      const existingIds = new Set((existingTraining || []).map((s: any) => s.id));

      // Separate into inserts and updates
      const newTrainingSessions = sessions
        .filter((s: any) => !existingIds.has(s.id))
        .map((s: any) => ({
          id: s.id,
          organization_id: orgRole.organization_id,
          team_id: teamId,
          season_id: seasonId || null,
          date: s.date,
          duration_min: 90,
          session_type: s.type === "training" ? "training" : s.type === "rest" ? "rest" : "match",
          title: s.type === "training"
            ? "Sesión"
            : s.type === "rest"
            ? "Descanso"
            : `${s.type === "friendly" ? "Amistoso" : "Liga"} vs ${s.opponent || "Rival"}`,
          status: "planned",
          match_opponent: (s.type === "friendly" || s.type === "league") ? s.opponent || null : null,
          match_is_home: (s.type === "friendly" || s.type === "league")
            ? !(s.location?.toLowerCase().includes("visitante") || s.location?.toLowerCase().includes("fuera"))
            : null,
          match_competition: s.type === "friendly" ? "Amistoso" : s.type === "league" ? "Liga" : null,
          notes: s.comments || null,
        }));

      // Insert new ones in bulk
      if (newTrainingSessions.length > 0) {
        const { error: insertError } = await supabase
          .from("training_sessions")
          .insert(newTrainingSessions);
        if (insertError) throw insertError;
      }

      // Update existing ones individually (to preserve exercises, convocations, wellness)
      const updatePromises = sessions
        .filter((s: any) => existingIds.has(s.id))
        .map(async (s: any) => {
          const { error: updateError } = await supabase
            .from("training_sessions")
            .update({
              date: s.date,
              session_type: s.type === "training" ? "training" : s.type === "rest" ? "rest" : "match",
              title: s.type === "training"
                ? "Sesión"
                : s.type === "rest"
                ? "Descanso"
                : `${s.type === "friendly" ? "Amistoso" : "Liga"} vs ${s.opponent || "Rival"}`,
              match_opponent: (s.type === "friendly" || s.type === "league") ? s.opponent || null : null,
              match_is_home: (s.type === "friendly" || s.type === "league")
                ? !(s.location?.toLowerCase().includes("visitante") || s.location?.toLowerCase().includes("fuera"))
                : null,
              match_competition: s.type === "friendly" ? "Amistoso" : s.type === "league" ? "Liga" : null,
              notes: s.comments || null,
            })
            .eq("id", s.id);
          if (updateError) throw updateError;
        });

      await Promise.all(updatePromises);
    }

    // 5. Recalculate training calendar sequence metrics (microcycles, sequence numbers) in one batch
    await recalculateAndSaveSessionMetrics(teamId, supabase);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("[POST /api/training/preseason] Error:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
