import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgTeams, getSquadPlayers } from "@/services/players";
import { getSessionTemplates } from "@/services/templates";
import { getTaskLibrary } from "@/services/tasks";
import { SessionForm } from "@/components/training/SessionForm";
import { CalendarDays } from "lucide-react";

export const metadata: Metadata = {
  title: "Nueva Sesión — ClubLab",
  description: "Planificar una nueva sesión de entrenamiento",
};

export const dynamic = "force-dynamic";

export default async function NewSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ teamId?: string; date?: string; type?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Load user's organization role and settings
  const { data: orgRole } = await supabase
    .from("user_organization_roles")
    .select(`
      organization_id, 
      role, 
      team_id,
      organizations (
        settings
      )
    `)
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!orgRole) {
    redirect("/onboarding");
  }

  const resolvedSearchParams = await searchParams;
  const teams = await getOrgTeams();
  const activeTeamId = resolvedSearchParams.teamId ?? orgRole.team_id ?? teams[0]?.id ?? null;
  const initialDate = resolvedSearchParams.date ?? null;
  const initialType = (resolvedSearchParams.type as any) ?? null;

  const [squadPlayers, templates, exerciseLibrary] = await Promise.all([
    activeTeamId ? getSquadPlayers(activeTeamId) : Promise.resolve([]),
    getSessionTemplates(),
    getTaskLibrary(orgRole.organization_id, user.id),
  ]);

  const orgSettings = (orgRole as any)?.organizations?.settings ?? {};

  return (
    <div className="flex flex-col gap-6">
      {/* ── HEADER ── */}
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl btn-corporate shadow-lg">
            <CalendarDays className="h-4.5 w-4.5 text-white" />
          </div>
          <span>Nueva Sesión {initialDate ? `(${initialDate})` : ""}</span>
        </h1>
        <p className="text-slate-400 text-sm mt-1 ml-11">
          Diseña las tareas, convoca a los jugadores y planifica zonas tácticas y equipamiento.
        </p>
      </div>

      {/* ── FORM ── */}
      <SessionForm
        organizationId={orgRole.organization_id}
        userId={user.id}
        teams={teams}
        squadPlayers={squadPlayers}
        templates={templates}
        exerciseLibrary={exerciseLibrary}
        organizationSettings={orgSettings}
        userTeamId={orgRole.team_id}
        userRole={orgRole.role}
        initialDate={initialDate}
        initialSessionType={initialType}
      />
    </div>
  );
}
