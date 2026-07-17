import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPlayerById, getOrgTeams } from "@/services/players";
import { EditPlayerForm } from "./EditPlayerForm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const player = await getPlayerById(id);
  if (!player) return { title: "Jugador no encontrado — ClubLab" };
  return { title: `Editar ${player.first_name} ${player.last_name} — ClubLab` };
}

export default async function EditPlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let userRole = "player";
  if (user) {
    const { data: orgRole } = await supabase
      .from("user_organization_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();
    if (orgRole) userRole = orgRole.role;
  }

  const [player, teams] = await Promise.all([getPlayerById(id), getOrgTeams()]);

  if (!player) notFound();

  return (
    <div className="max-w-2xl">
      <EditPlayerForm player={player} teams={teams as any} userRole={userRole} />
    </div>
  );
}
