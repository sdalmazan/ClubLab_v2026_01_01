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

    // Query player profile for fallback weight
    const { data: playerProfile } = await adminSupabase
      .from("players")
      .select("id, weight_kg")
      .eq("id", playerId)
      .maybeSingle();

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
      .order("created_at", { ascending: false })
      .limit(60);

    // Query session attendance for attendance/weight/RPE fallback
    const { data: attendanceList } = await adminSupabase
      .from("session_attendance")
      .select("*, training_sessions(date, title)")
      .eq("player_id", playerId)
      .order("created_at", { ascending: false })
      .limit(60);

    // Combine by date
    const historyMap = new Map<string, any>();

    // 1. Process wellness checkins
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
        weight_kg: w.weight_kg ?? playerProfile?.weight_kg ?? null,
        has_discomfort: w.has_discomfort,
        discomfort_body_part: w.discomfort_body_part,
        notes: w.comments || w.notes,
      };
    });

    // 2. Process RPE entries
    (rpe || []).forEach((r) => {
      const rDate = r.created_at ? r.created_at.split("T")[0] : null;
      if (!rDate) return;
      if (!historyMap.has(rDate)) {
        historyMap.set(rDate, { date: rDate });
      }
      const item = historyMap.get(rDate);
      item.checkout = {
        rpe: r.rpe,
        session_title: (r.training_sessions as any)?.title || "Sesión",
        post_feeling: r.post_feeling,
        notes: r.notes,
      };
    });

    // 3. Process session attendance records for fallbacks (weight, RPE, attendance)
    (attendanceList || []).forEach((att) => {
      const sessDate = (att.training_sessions as any)?.date || att.created_at?.split("T")[0];
      if (!sessDate) return;

      if (!historyMap.has(sessDate)) {
        historyMap.set(sessDate, { date: sessDate });
      }
      const item = historyMap.get(sessDate);

      // If checkin weight was recorded on session attendance or player profile
      const attWeight = att.checkin_weight || att.weight_kg || playerProfile?.weight_kg;
      if (item.checkin) {
        if (item.checkin.weight_kg == null && attWeight != null) {
          item.checkin.weight_kg = attWeight;
        }
      } else {
        item.checkin = {
          sleep_quality: null,
          fatigue: null,
          mood: null,
          muscle_soreness: null,
          stress: null,
          weight_kg: attWeight ?? null,
          notes: att.notes || null,
        };
      }

      // If checkout RPE was recorded on session attendance
      const attRpe = att.rpe || att.checkout_rpe;
      if (attRpe != null) {
        if (!item.checkout) {
          item.checkout = {
            rpe: attRpe,
            session_title: (att.training_sessions as any)?.title || "Sesión",
            notes: att.notes || null,
          };
        } else if (item.checkout.rpe == null) {
          item.checkout.rpe = attRpe;
        }
      }
    });

    const sortedHistory = Array.from(historyMap.values()).sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    return NextResponse.json({ history: sortedHistory });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
