import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgTeams, getSquadPlayers } from "@/services/players";
import { getSessionTemplates } from "@/services/templates";
import { getTaskLibrary } from "@/services/tasks";
import { getSessionById } from "@/services/sessions";
import { SessionForm } from "@/components/training/SessionForm";
import { CalendarDays } from "lucide-react";

export const metadata: Metadata = {
  title: "Editar Sesión — ClubLab",
  description: "Editar sesión de entrenamiento",
};

export const dynamic = "force-dynamic";

export default async function EditSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  // Load the session data
  const session = await getSessionById(id);
  if (!session) {
    notFound();
  }

  const teams = await getOrgTeams();
  const activeTeamId = session.team_id;

  const [squadPlayers, templates, exerciseLibrary] = await Promise.all([
    getSquadPlayers(activeTeamId),
    getSessionTemplates(),
    getTaskLibrary(orgRole.organization_id, user.id),
  ]);

  const orgSettings = (orgRole as any)?.organizations?.settings ?? {};

  return (
    <div className="flex flex-col gap-6">
      {/* ── HEADER ── */}
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-black/30">
            <CalendarDays className="h-4.5 w-4.5" />
          </div>
          <span>Editar Sesión</span>
        </h1>
        <p className="text-slate-400 text-sm mt-1 ml-11">
          Modifica los detalles, convocatoria o reordena los ejercicios de esta sesión.
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
        initialData={session}
        organizationSettings={orgSettings}
        userTeamId={orgRole.team_id}
        userRole={orgRole.role}
      />
    </div>
  );
}
