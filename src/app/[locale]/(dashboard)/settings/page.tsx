import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SettingsForm } from "./SettingsForm";

export const metadata: Metadata = {
  title: "Ajustes de Perfil — ClubLab",
  description: "Modifica tus datos de perfil y configuración de seguridad",
};

export default async function SettingsPage() {
  const supabase = await createClient();

  // Get authenticated user
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  // Load user's organization role and details
  const { data: orgRole } = await supabase
    .from("user_organization_roles")
    .select(`
      role,
      organization_id,
      organizations (
        name,
        settings
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  const role = orgRole?.role ?? "No asignado";
  const orgName = (orgRole as any)?.organizations?.name ?? "Sin organización";
  const orgSettings = (orgRole as any)?.organizations?.settings ?? {};
  const orgId = orgRole?.organization_id ?? "";
  const fullName = user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Usuario";

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-extrabold text-white tracking-tight">
          Ajustes de Perfil
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Gestiona los detalles de tu cuenta y opciones de seguridad
        </p>
      </div>

      <SettingsForm
        initialEmail={user.email ?? ""}
        initialName={fullName}
        role={role}
        organizationName={orgName}
        organizationId={orgId}
        organizationSettings={orgSettings}
      />
    </div>
  );
}
