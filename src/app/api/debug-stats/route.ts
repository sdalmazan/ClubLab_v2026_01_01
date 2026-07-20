import { NextResponse } from "next/server";
import { statsAdmin } from "@/lib/supabase/stats-admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const diagnostics: any = {};
  
  diagnostics.env = {
    statsUrl: process.env.NEXT_PUBLIC_FEDERATION_SUPABASE_URL ? "DEFINED" : "MISSING",
    statsKey: process.env.FEDERATION_SUPABASE_SERVICE_ROLE_KEY ? "DEFINED" : "MISSING",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? "DEFINED" : "MISSING",
    supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? "DEFINED" : "MISSING",
  };

  try {
    const { data: matches, error } = await statsAdmin
      .from("stat_matches")
      .select("*")
      .or("home_team.ilike.%Almaz%n%,away_team.ilike.%Almaz%n%")
      .eq("season", "2025/2026")
      .limit(5);

    diagnostics.matchesQuery = {
      success: !error,
      error: error || null,
      count: matches?.length || 0,
      matches: matches || []
    };
  } catch (e: any) {
    diagnostics.matchesQuery = {
      success: false,
      error: e.message || String(e)
    };
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    diagnostics.auth = {
      loggedIn: !!user,
      email: user?.email || null,
      id: user?.id || null
    };

    if (user) {
      const { data: orgRole } = await supabase
        .from("user_organization_roles")
        .select(`
          team_id,
          organization_id,
          organizations (
            name,
            type,
            logo_url,
            settings
          )
        `)
        .eq("user_id", user.id)
        .single();
      
      diagnostics.orgRole = orgRole;
    }
  } catch (e: any) {
    diagnostics.auth = {
      error: e.message || String(e)
    };
  }

  return NextResponse.json(diagnostics);
}
