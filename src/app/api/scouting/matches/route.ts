import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { statsAdmin } from "@/lib/supabase/stats-admin";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    // Check session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const season = searchParams.get("season") || "2025/2026";
    const competition = searchParams.get("competition") || "Tercera Federación - Grupo 8";

    // Fetch matches from Statistics_DB
    const { data: matches, error } = await statsAdmin
      .from("stat_matches")
      .select("*")
      .eq("season", season)
      .eq("competition", competition)
      .order("matchday", { ascending: true })
      .order("match_date", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(matches || []);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
