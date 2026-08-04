import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const playerId = searchParams.get("playerId");

    if (!playerId) {
      return NextResponse.json({ error: "playerId parameter is required" }, { status: 400 });
    }

    const adminSupabase = createAdminClient();

    // Query past wellness records for player
    const { data: wellness } = await adminSupabase
      .from("player_wellness_checkins")
      .select("*")
      .eq("player_id", playerId)
      .order("date", { ascending: false })
      .limit(60);

    // Query past RPE records for player
    const { data: rpe } = await adminSupabase
      .from("rpe_entries")
      .select("*, training_sessions(title)")
      .eq("player_id", playerId)
      .order("date", { ascending: false })
      .limit(60);

    // Combine by date
    const historyMap = new Map<string, any>();

    (wellness || []).forEach((w) => {
      if (!historyMap.has(w.date)) {
        historyMap.set(w.date, { date: w.date });
      }
      const item = historyMap.get(w.date);
      item.checkin = {
        sleep_quality: w.sleep_quality,
        fatigue: w.fatigue,
        mood: w.mood,
        muscle_soreness: w.muscle_soreness ?? w.soreness,
        stress: w.stress,
        weight_kg: w.weight_kg,
        has_discomfort: w.has_discomfort,
        discomfort_body_part: w.discomfort_body_part,
        notes: w.comments || w.notes,
      };
    });

    (rpe || []).forEach((r) => {
      if (!historyMap.has(r.date)) {
        historyMap.set(r.date, { date: r.date });
      }
      const item = historyMap.get(r.date);
      item.checkout = {
        rpe: r.rpe,
        session_title: (r.training_sessions as any)?.title || "Sesión",
        post_feeling: r.post_feeling,
        notes: r.notes,
      };
    });

    const sortedHistory = Array.from(historyMap.values()).sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    return NextResponse.json({ history: sortedHistory });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
