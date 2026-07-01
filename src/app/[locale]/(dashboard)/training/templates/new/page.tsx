import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTaskLibrary } from "@/services/tasks";
import { TemplateForm } from "@/components/training/TemplateForm";
import { BookOpen } from "lucide-react";

export const metadata: Metadata = {
  title: "Nueva Plantilla — ClubLab",
  description: "Crear una nueva plantilla estructurada de sesión",
};

export const dynamic = "force-dynamic";

export default async function NewTemplatePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Load user's organization role
  const { data: orgRole } = await supabase
    .from("user_organization_roles")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!orgRole) {
    redirect("/onboarding");
  }

  const exerciseLibrary = await getTaskLibrary(orgRole.organization_id, user.id);

  return (
    <div className="flex flex-col gap-6">
      {/* ── HEADER ── */}
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-lg shadow-emerald-950/50">
            <BookOpen className="h-4.5 w-4.5 text-white" />
          </div>
          <span>Nueva Plantilla</span>
        </h1>
        <p className="text-slate-400 text-sm mt-1 ml-11">
          Diseña una estructura teórica de sesión, definiendo tiempos de ejercicio y materiales por defecto.
        </p>
      </div>

      {/* ── FORM ── */}
      <TemplateForm
        organizationId={orgRole.organization_id}
        userId={user.id}
        exerciseLibrary={exerciseLibrary}
      />
    </div>
  );
}
