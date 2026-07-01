import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlayerById } from "@/services/players";
import { getPerformanceTestsByPlayerId } from "@/services/tests";
import { ArrowLeft, ClipboardList } from "lucide-react";

export const dynamic = "force-dynamic";

type PlayerTestsPageProps = {
  params: Promise<{
    id: string;
    locale: string;
  }>;
};

export default async function PlayerTestsPage({
  params,
}: PlayerTestsPageProps) {
  const { id } = await params;

  const [player, tests] = await Promise.all([
    getPlayerById(id),
    getPerformanceTestsByPlayerId(id),
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

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Historial de tests físicos
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {player.first_name} {player.last_name}
            {player.membership?.jersey_number != null && ` (Dorsal #${player.membership.jersey_number})`}
          </p>
        </div>
        <Link
          href={`/players/${id}/tests/new`}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-sm font-semibold px-4 py-2.5 transition-all shadow-lg shadow-emerald-950/40"
        >
          <ClipboardList className="h-4 w-4" />
          Registrar nuevo test
        </Link>
      </div>

      {/* History table */}
      <div className="glass rounded-2xl p-6">
        {tests.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-10">
            No hay pruebas físicas registradas para este jugador.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <th className="pb-3 pr-4">Fecha</th>
                  <th className="pb-3 px-4">Prueba</th>
                  <th className="pb-3 px-4">Resultado</th>
                  <th className="pb-3 pl-4">Observaciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {tests.map((test) => (
                  <tr key={test.id} className="hover:bg-white/[0.01] transition-colors">
                    <td className="py-4 pr-4 font-semibold text-slate-350 whitespace-nowrap">
                      {test.date}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-extrabold text-white">
                          {test.physical_tests?.name || "Test"}
                        </span>
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                          {test.physical_tests?.category || "General"}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center bg-white/5 border border-white/10 text-emerald-400 font-extrabold px-3 py-1 rounded-lg">
                        {test.value} {test.physical_tests?.unit}
                      </span>
                    </td>
                    <td className="py-4 pl-4 text-slate-400 italic max-w-xs truncate" title={test.notes ?? undefined}>
                      {test.notes ? `"${test.notes}"` : <span className="text-slate-650">Sin observaciones</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
