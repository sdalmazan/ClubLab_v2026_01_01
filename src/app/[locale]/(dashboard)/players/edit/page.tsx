import type { Metadata } from "next";
import { getSquadPlayers, getOrgTeams } from "@/services/players";
import { createClient } from "@/lib/supabase/server";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { BulkEditForm } from "./BulkEditForm";
import { cookies } from "next/headers";

export const metadata: Metadata = {
  title: "Editar plantilla — ClubLab",
  description: "Edición masiva de la plantilla del equipo",
};

export const dynamic = "force-dynamic";

export default async function BulkEditPlayersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Load organization role, settings, and active seasons
  const { data: orgRole } = await supabase
    .from("user_organization_roles")
    .select(`
      role,
      team_id,
      organization_id,
      organizations (
        type,
        settings,
        clubs (
          id,
          seasons (
            id,
            name,
            is_active
          )
        )
      )
    `)
    .eq("user_id", user?.id)
    .single();

  const userRole = orgRole?.role ?? "player";
  const organizationId = orgRole?.organization_id ?? "";
  const org = orgRole?.organizations as any;
  const orgType = org?.type ?? "club";
  const organizationSettings = org?.settings ?? {};

  // Resolve active season
  const clubs = Array.isArray(org?.clubs) ? org.clubs : org?.clubs ? [org.clubs] : [];
  const activeClub = clubs[0];
  const seasons = activeClub?.seasons
    ? Array.isArray(activeClub.seasons) ? activeClub.seasons : [activeClub.seasons]
    : [];
  const activeSeason = seasons.find((s: any) => s.is_active) ?? seasons[0];
  const activeSeasonId = activeSeason?.id ?? "";

  const cookieStore = await cookies();
  const globalTeamId = cookieStore.get("cl_active_team_id")?.value;
  const resolvedTeamId = globalTeamId || orgRole?.team_id || "";

  const [players, teams] = await Promise.all([
    getSquadPlayers(resolvedTeamId || undefined),
    getOrgTeams(),
  ]);

  // Read positions custom labels to display in selecting dropdown
  const customPositions = organizationSettings.custom_positions ?? [];

  return (
    <div className="flex flex-col gap-6 max-w-7xl">
      <Link
        href="/players"
        className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors w-fit"
        id="back-btn"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a plantilla
      </Link>

      <div>
        <h1 className="text-2xl font-extrabold text-white">Editar plantilla en lote</h1>
        <p className="text-slate-400 text-sm mt-0.5">Modifica rápidamente los campos de múltiples jugadores desde una sola tabla</p>
      </div>

      <BulkEditForm
        initialPlayers={players}
        customPositions={customPositions}
        userRole={userRole}
        organizationId={organizationId}
        teamId={resolvedTeamId || (teams as any[])[0]?.id || ""}
        seasonId={activeSeasonId}
      />
    </div>
  );
}
