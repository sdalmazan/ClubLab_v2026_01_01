import type { Metadata } from "next";
import { getSessionTemplates } from "@/services/templates";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TemplatesClient } from "@/components/training/TemplatesClient";

export const metadata: Metadata = {
  title: "Plantillas de Sesión — ClubLab",
  description: "Biblioteca de plantillas estructuradas de entrenamiento",
};

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Load user role
  const { data: orgRole } = await supabase
    .from("user_organization_roles")
    .select("role")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  const userRole = orgRole?.role || "coach";
  const templates = await getSessionTemplates();

  return (
    <TemplatesClient
      templates={templates}
      userRole={userRole}
      userId={user.id}
    />
  );
}
