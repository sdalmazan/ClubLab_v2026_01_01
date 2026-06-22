import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPlayerById, getOrgTeams } from "@/services/players";
import { EditPlayerForm } from "./EditPlayerForm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

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
  const [player, teams] = await Promise.all([getPlayerById(id), getOrgTeams()]);

  if (!player) notFound();

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <Link
        href={`/players/${id}`}
        className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors w-fit"
        id="back-to-player"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a la ficha
      </Link>

      <div>
        <h1 className="text-2xl font-extrabold text-white">
          Editar jugador
        </h1>
        <p className="text-slate-400 text-sm mt-0.5">
          {player.first_name} {player.last_name}
        </p>
      </div>

      <EditPlayerForm player={player} teams={teams as any} />
    </div>
  );
}
