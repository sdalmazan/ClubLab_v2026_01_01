import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPlayerById } from "@/services/players";
import { createClient } from "@/lib/supabase/server";
import { getPerformanceTestsByPlayerId } from "@/services/tests";
import { getPlayerTasks } from "@/services/tasks";
import { PlayerProfileWorkspace } from "@/components/players/PlayerProfileWorkspace";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const player = await getPlayerById(id);
  if (!player) return { title: "Jugador no encontrado — ClubLab" };
  return {
    title: `${player.first_name} ${player.last_name} — ClubLab`,
    description: `Ficha de jugador: ${player.first_name} ${player.last_name}`,
  };
}

export default async function PlayerDetailPage({
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

  const [player, tests, tasks] = await Promise.all([
    getPlayerById(id),
    getPerformanceTestsByPlayerId(id, 10),
    getPlayerTasks(id),
  ]);

  if (!player) notFound();

  return (
    <PlayerProfileWorkspace
      player={player}
      tests={tests}
      tasks={tasks}
      userRole={userRole}
    />
  );
}
