import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlayerById } from "@/services/players";
import { getTestTypes } from "@/services/tests";
import { ArrowLeft } from "lucide-react";
import { NewTestForm } from "./NewTestForm";

export const dynamic = "force-dynamic";

type NewTestPageProps = {
  params: Promise<{
    id: string;
    locale: string;
  }>;
};

export default async function NewTestPage({ params }: NewTestPageProps) {
  const { id } = await params;

  const [player, testTypes] = await Promise.all([
    getPlayerById(id),
    getTestTypes(),
  ]);

  if (!player) notFound();

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Back button */}
      <Link
        href={`/players/${id}`}
        className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a la ficha
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">
          Registrar test físico
        </h1>
        <p className="text-slate-400 text-sm mt-0.5">
          Añadir resultado para {player.first_name} {player.last_name}
          {player.membership?.jersey_number != null && ` (Dorsal #${player.membership.jersey_number})`}
        </p>
      </div>

      <NewTestForm playerId={id} testTypes={testTypes} />
    </div>
  );
}
