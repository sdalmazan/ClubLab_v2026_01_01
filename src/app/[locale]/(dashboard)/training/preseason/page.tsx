import type { Metadata } from "next";
import { getOrgTeams } from "@/services/players";
import { PreseasonPlanner } from "@/components/training/PreseasonPlanner";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Planning de Pretemporada — ClubLab",
  description: "Planifica de manera específica tu pretemporada",
};

export const dynamic = "force-dynamic";

export default async function PreseasonPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Load organization role & teams
  const { data: orgRole } = await supabase
    .from("user_organization_roles")
    .select(`
      organization_id,
      role,
      organizations (
        type
      )
    `)
    .eq("user_id", user?.id)
    .single();

  const orgId = orgRole?.organization_id ?? "";
  const orgType = (orgRole?.organizations as any)?.type || "club";
  const isAdmin = orgRole?.role === "super_admin" || orgRole?.role === "club_admin";
  const isCoordinator = [
    "super_admin",
    "club_admin",
    "academy_director",
    "academy_coordinator",
    "sporting_director"
  ].includes(orgRole?.role ?? "");
  
  let teams = await getOrgTeams();
  if (orgType === "club" && teams.length > 0) {
    teams = [teams[0]];
  }

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto">
      {/* Back button */}
      <div className="no-print">
        <Link
          href="/training"
          className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors w-fit"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Planificación
        </Link>
      </div>

      <div className="no-print">
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Planning de Pretemporada</h1>
        <p className="text-slate-400 text-sm mt-0.5">
          Planifica el ciclo preparatorio semana a semana. Puedes configurar sesiones de entrenamiento, partidos amistosos y liga.
        </p>
      </div>

      <div>
        <PreseasonPlanner 
          teams={teams} 
          organizationId={orgId} 
          isAdmin={isAdmin} 
          canSwitchTeams={isCoordinator} 
        />
      </div>
    </div>
  );
}
