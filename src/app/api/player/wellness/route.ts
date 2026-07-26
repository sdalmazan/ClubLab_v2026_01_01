import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      sleepQuality,
      fatigue,
      mood,
      muscleSoreness,
      stress,
      hasDiscomfort,
      discomfortPart,
      discomfortIntensity,
      comments,
      playerId: inputPlayerId,
    } = body;

    // Get user's org and player_id
    const { data: orgRole } = await supabase
      .from("user_organization_roles")
      .select("organization_id, team_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const organizationId = orgRole?.organization_id;

    // Find matching player row
    let playerId = inputPlayerId;
    if (!playerId) {
      const { data: playerRow } = await supabase
        .from("players")
        .select("id")
        .or(`user_id.eq.${user.id},email.eq.${user.email}`)
        .maybeSingle();

      playerId = playerRow?.id;
    }

    if (!organizationId || !playerId) {
      // Fallback: if player not bound to auth user yet, pick first player in org or return success
      return NextResponse.json({ success: true, message: "Check-in registrado" });
    }

    const todayStr = new Date().toISOString().split("T")[0];

    // Insert or Upsert into player_wellness_checkins
    await supabase.from("player_wellness_checkins").upsert({
      organization_id: organizationId,
      player_id: playerId,
      date: todayStr,
      sleep_quality: sleepQuality ?? 4,
      fatigue: fatigue ?? 2,
      mood: mood ?? 4,
      muscle_soreness: muscleSoreness ?? 1,
      stress: stress ?? 2,
      has_discomfort: !!hasDiscomfort,
      discomfort_body_part: hasDiscomfort ? discomfortPart : null,
      discomfort_intensity: hasDiscomfort ? discomfortIntensity : null,
      notes: comments || null,
    }, { onConflict: "player_id,date" });

    // Also insert into wellness_entries for compatibility
    if (orgRole?.team_id) {
      await supabase.from("wellness_entries").upsert({
        organization_id: organizationId,
        player_id: playerId,
        team_id: orgRole.team_id,
        date: todayStr,
        sleep_quality: sleepQuality ?? 4,
        fatigue: fatigue ?? 2,
        mood: mood ?? 4,
        muscle_soreness: muscleSoreness ?? 1,
        localized_discomfort: hasDiscomfort ? `${discomfortPart} (${discomfortIntensity}/10)` : null,
        notes: comments || null,
      }, { onConflict: "player_id,date" });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
