import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServiceRoleClient } from "@supabase/supabase-js";
import { statsAdmin } from "@/lib/supabase/stats-admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const diagnostics: any = {};
  
  diagnostics.env = {
    statsUrl: process.env.NEXT_PUBLIC_FEDERATION_SUPABASE_URL ? "DEFINED" : "MISSING",
    statsKey: process.env.FEDERATION_SUPABASE_SERVICE_ROLE_KEY ? "DEFINED" : "MISSING",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? "DEFINED" : "MISSING",
    supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? "DEFINED" : "MISSING",
  };

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || "";

    diagnostics.targetUserId = userId;

    // Create service role client to bypass RLS for debugging
    const serviceClient = createServiceRoleClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Fetch orgRole
    const { data: orgRole, error: orgRoleErr } = await serviceClient
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
      .eq("user_id", userId)
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
      const { data: clubs, error: clubsErr } = await serviceClient
        .from("clubs")
        .select("id")
        .eq("organization_id", orgRole.organization_id);
      
      diagnostics.clubsQuery = {
        data: clubs,
        error: clubsErr || null
      };

      const clubIds = clubs?.map((c: any) => c.id) || [];
      if (clubIds.length > 0) {
        const { data: firstTeam, error: firstTeamErr } = await serviceClient
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

    // 3. Fetch matches
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
        cleanClubName,
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
