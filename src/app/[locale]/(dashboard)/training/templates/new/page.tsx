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

interface PageProps {
  searchParams: Promise<{ cloneFrom?: string }>;
}

export default async function NewTemplatePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const cloneFrom = params.cloneFrom;
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

  let initialData = null;
  if (cloneFrom) {
    const { getTemplateById } = await import("@/services/templates");
    initialData = await getTemplateById(cloneFrom);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── HEADER ── */}
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl btn-corporate shadow-lg">
            <BookOpen className="h-4.5 w-4.5 text-white" />
          </div>
          <span>{cloneFrom ? "Clonar Plantilla" : "Nueva Plantilla"}</span>
        </h1>
        <p className="text-slate-400 text-sm mt-1 ml-11">
          {cloneFrom 
            ? "Clona y personaliza una plantilla existente para guardarla en tu biblioteca personal o de la academia."
            : "Diseña una estructura teórica de sesión, definiendo tiempos de ejercicio y materiales por defecto."
          }
        </p>
      </div>

      {/* ── FORM ── */}
      <TemplateForm
        organizationId={orgRole.organization_id}
        userId={user.id}
        exerciseLibrary={exerciseLibrary}
        initialData={initialData}
        isClone={!!cloneFrom}
        userRole={orgRole.role}
      />
    </div>
  );
}
