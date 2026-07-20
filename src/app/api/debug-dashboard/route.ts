import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { statsAdmin } from "@/lib/supabase/stats-admin";
import { getSquadPlayers } from "@/services/players";

export const dynamic = "force-dynamic";

export async function GET() {
  const diagnostics: any = {};
  
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    
    diagnostics.auth = {
      user: user ? { id: user.id, email: user.email } : null,
      error: authErr || null
    };

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // 1. Fetch orgRole
    const { data: orgRole, error: orgRoleErr } = await supabase
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

    diagnostics.orgRoleQuery = {
      data: orgRole,
      error: orgRoleErr || null
    };

    const orgData = orgRole?.organizations as any;
    const orgType = orgData?.type || "club";
    const clubName = orgData?.settings?.club_name || orgData?.name || "ClubLab";

    diagnostics.extracted = {
      orgType,
      clubName
    };

    // 2. Resolve team
    let resolvedTeamId = orgType === "club" ? "" : (orgRole?.team_id || "");
    diagnostics.beforeFallback = { resolvedTeamId };

    if (!resolvedTeamId && orgRole?.organization_id) {
      const { data: clubs, error: clubsErr } = await supabase
        .from("clubs")
        .select("id")
        .eq("organization_id", orgRole.organization_id);
      
      diagnostics.clubsQuery = {
        data: clubs,
        error: clubsErr || null
      };

      const clubIds = clubs?.map((c: any) => c.id) || [];
      if (clubIds.length > 0) {
        const { data: firstTeam, error: firstTeamErr } = await supabase
          .from("teams")
          .select("id, name")
          .in("club_id", clubIds)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        diagnostics.firstTeamQuery = {
          data: firstTeam,
          error: firstTeamErr || null
        };

        if (firstTeam) {
          resolvedTeamId = firstTeam.id;
        }
      }
    }

    diagnostics.final = { resolvedTeamId };

    // 3. Fetch players
    const players = await getSquadPlayers(resolvedTeamId || undefined);
    diagnostics.players = {
      count: players.length,
      playersList: players.map(p => ({ id: p.id, name: p.first_name + " " + p.last_name, team: p.membership?.teams?.name }))
    };

    // 4. Fetch matches
    if (resolvedTeamId) {
      const cleanClubName = clubName
        .replace(/\b(S\.?D\.?|C\.?D\.?|C\.?F\.?|U\.?D\.?|S\.?A\.?D\.?|Club|Deportivo|Sociedad|Deportiva)\b/gi, "")
        .trim();
      const searchPattern = cleanClubName.replace(/[áéíóúÁÉÍÓÚ]/g, "%");

      const { data: federationMatches, error: fedError } = await statsAdmin
        .from("stat_matches")
        .select("*")
        .or(`home_team.ilike.%${searchPattern}%,away_team.ilike.%${searchPattern}%`)
        .eq("season", "2025/2026")
        .order("matchday", { ascending: false })
        .limit(5);

      diagnostics.federationQuery = {
        searchPattern,
        success: !fedError,
        error: fedError || null,
        count: federationMatches?.length || 0,
        matches: federationMatches || []
      };
    }

  } catch (e: any) {
    diagnostics.globalError = {
      message: e.message || String(e),
      stack: e.stack || null
    };
  }

  return NextResponse.json(diagnostics);
}
