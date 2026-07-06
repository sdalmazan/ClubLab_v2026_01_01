import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { statsAdmin } from "@/lib/supabase/stats-admin";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();

    // Check session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;

    // 1. Fetch match metadata
    const { data: match, error: matchErr } = await statsAdmin
      .from("stat_matches")
      .select("*")
      .eq("id", id)
      .single();

    if (matchErr) {
      return NextResponse.json({ error: matchErr.message }, { status: 404 });
    }

    // 2. Fetch lineups
    const { data: lineups, error: lineupsErr } = await statsAdmin
      .from("stat_lineups")
      .select("*")
      .eq("match_id", id)
      .order("is_starter", { ascending: false })
      .order("shirt_number", { ascending: true });

    if (lineupsErr) {
      return NextResponse.json({ error: lineupsErr.message }, { status: 500 });
    }

    // 3. Fetch events
    const { data: events, error: eventsErr } = await statsAdmin
      .from("stat_events")
      .select("*")
      .eq("match_id", id)
      .order("minute", { ascending: true })
      .order("extra_time", { ascending: true });

    if (eventsErr) {
      return NextResponse.json({ error: eventsErr.message }, { status: 500 });
    }

    // 4. Fetch private organization overrides
    const { data: orgRole } = await supabase
      .from("user_organization_roles")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    let orgOverrides = { overrides: {}, local_staff: null, visitor_staff: null };
    if (orgRole) {
      const { data: org } = await supabase
        .from("organizations")
        .select("settings")
        .eq("id", orgRole.organization_id)
        .single();
      if (org?.settings?.scouting?.matches?.[id]) {
        orgOverrides = org.settings.scouting.matches[id];
      }
    }

    return NextResponse.json({
      match,
      lineups: lineups || [],
      events: events || [],
      scouting: orgOverrides,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
