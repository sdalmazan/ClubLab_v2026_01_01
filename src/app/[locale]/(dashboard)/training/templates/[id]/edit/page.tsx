import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTaskLibrary } from "@/services/tasks";
import { getTemplateById } from "@/services/templates";
import { TemplateForm } from "@/components/training/TemplateForm";
import { BookOpen } from "lucide-react";

export const metadata: Metadata = {
  title: "Editar Plantilla — ClubLab",
  description: "Editar plantilla estructurada de sesión",
};

export const dynamic = "force-dynamic";

export default async function EditTemplatePage({
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

  const template = await getTemplateById(id);
  if (!template) {
    notFound();
  }

  const exerciseLibrary = await getTaskLibrary(orgRole.organization_id, user.id);

  return (
    <div className="flex flex-col gap-6">
      {/* ── HEADER ── */}
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-black/30">
            <BookOpen className="h-4.5 w-4.5" />
          </div>
          <span>Editar Plantilla</span>
        </h1>
        <p className="text-slate-400 text-sm mt-1 ml-11">
          Modifica la secuencia de ejercicios o ajusta los parámetros estructurales de esta plantilla.
        </p>
      </div>

      {/* ── FORM ── */}
      <TemplateForm
        organizationId={orgRole.organization_id}
        userId={user.id}
        exerciseLibrary={exerciseLibrary}
        initialData={template}
        userRole={orgRole.role}
      />
    </div>
  );
}
