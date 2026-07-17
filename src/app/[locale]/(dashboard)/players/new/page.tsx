import type { Metadata } from "next";
import { CreatePlayerForm } from "./CreatePlayerForm";
import { getOrgTeams } from "@/services/players";
import { createClient } from "@/lib/supabase/server";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Añadir jugador — ClubLab",
  description: "Registra un nuevo jugador en tu plantilla",
};

export const dynamic = "force-dynamic";

export default async function NewPlayerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Get org info for the service call
  const { data: roleData } = await supabase
    .from("user_organization_roles")
    .select("role, organization_id, organizations(id, clubs(id, seasons(id, name, is_active)))")
    .eq("user_id", user!.id)
    .single();

  const teams = await getOrgTeams();

  // Extract active season id
  const org = roleData?.organizations as any;
  const clubs = Array.isArray(org?.clubs) ? org.clubs : org?.clubs ? [org.clubs] : [];
  const activeClub = clubs[0];
  const seasons = activeClub?.seasons
    ? Array.isArray(activeClub.seasons) ? activeClub.seasons : [activeClub.seasons]
    : [];
  const activeSeason = seasons.find((s: any) => s.is_active) ?? seasons[0];
  const organizationId = roleData?.organization_id ?? "";
  const userRole = roleData?.role ?? "player";

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <Link
        href="/players"
        className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors w-fit"
        id="back-btn"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a plantilla
      </Link>

      <div>
        <h1 className="text-2xl font-extrabold text-white">Añadir jugador</h1>
        <p className="text-slate-400 text-sm mt-0.5">Registra un nuevo jugador en tu organización</p>
      </div>

      <CreatePlayerForm
        teams={teams as any}
        defaultSeasonId={activeSeason?.id ?? ""}
        organizationId={organizationId}
        userRole={userRole}
      />
    </div>
  );
}
