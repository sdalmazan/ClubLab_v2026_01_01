import { notFound } from "next/navigation";
import Link from "next/link";
import { getPlayerById } from "@/services/players";
import { getTaskLibrary, getPlayerTasks } from "@/services/tasks";
import { ArrowLeft } from "lucide-react";
import { PlayerTasksClient } from "./PlayerTasksClient";

export const dynamic = "force-dynamic";

type PlayerTasksPageProps = {
  params: Promise<{
    id: string;
    locale: string;
  }>;
};

export default async function PlayerTasksPage({
  params,
}: PlayerTasksPageProps) {
  const { id } = await params;

  const [player, library, assignedTasks] = await Promise.all([
    getPlayerById(id),
    getTaskLibrary(),
    getPlayerTasks(id),
  ]);

  if (!player) notFound();

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      {/* Back button */}
      <Link
        href={`/players/${id}`}
        className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a la ficha
      </Link>

      <PlayerTasksClient
        player={player}
        library={library}
        initialTasks={assignedTasks}
        playerId={id}
      />
    </div>
  );
}
