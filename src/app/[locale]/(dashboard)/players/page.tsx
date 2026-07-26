import type { Metadata } from "next";
import { getSquadPlayers, getOrgTeams } from "@/services/players";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { SquadWorkspace } from "@/components/players/SquadWorkspace";

export const metadata: Metadata = {
  title: "Plantilla — ClubLab",
  description: "Gestión de la plantilla y jugadores del equipo",
};

export const dynamic = "force-dynamic";

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ teamId?: string }>;
}) {
  const params = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: orgRole } = await supabase
    .from("user_organization_roles")
    .select(`
      team_id,
      organizations ( name, type, settings )
    `)
    .eq("user_id", user?.id)
    .single();

  const orgData = (orgRole as any)?.organizations;
  const orgType = orgData?.type ?? "club";
  const clubName = orgData?.name ?? "ClubLab";
  
  const cookieStore = await cookies();
  const globalTeamId = cookieStore.get("cl_active_team_id")?.value;
  
  const resolvedTeamId = orgType === "academy" 
    ? params.teamId 
    : (globalTeamId || orgRole?.team_id || "");

  const [rawPlayers, teams] = await Promise.all([
    getSquadPlayers(resolvedTeamId || undefined),
    getOrgTeams(),
  ]);

  return (
    <SquadWorkspace
      players={rawPlayers}
      teams={teams}
      resolvedTeamId={resolvedTeamId || ""}
      orgType={orgType}
      clubName={clubName}
    />
  );
}
