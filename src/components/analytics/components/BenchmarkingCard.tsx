import React from "react";
import { Sparkles, ArrowUpRight, ArrowRightLeft, Trophy } from "lucide-react";
import { ExplorerRow } from "@/features/analysis/types";

interface BenchmarkingCardProps {
  rows: ExplorerRow[];
  myTeamName: string;
  onOpenPlayerProfile: (playerName: string) => void;
  onCompareWithClub: (playerName: string, positionCategory: string) => void;
  onShowTopLeague: (positionCategory: string, metricId: string) => void;
}

/**
 * BenchmarkingCard Component.
 * Automatically identifies top-performing players in the same league (outside our team)
 * for each position (Portero, Defensa, Centrocampista, Delantero) who exceed our team's averages.
 */
export const BenchmarkingCard: React.FC<BenchmarkingCardProps> = ({
  rows,
  myTeamName,
  onOpenPlayerProfile,
  onCompareWithClub,
  onShowTopLeague,
}) => {
  // Helper to normalize strings for comparison
  const normalizeTeamName = (name: string | undefined | null): string => {
    if (!name) return "";
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove accents
      .replace(/s\.?d\.?/gi, "")       // Remove S.D. / SD prefix
      .replace(/c\.?d\.?/gi, "")       // Remove C.D. / CD prefix
      .replace(/c\.?f\.?/gi, "")       // Remove C.F. / CF prefix
      .trim();
  };

  const cleanMyTeam = normalizeTeamName(myTeamName);

  // Position category helper
  const getPositionCategory = (pos: string | undefined): "gk" | "df" | "mc" | "fw" => {
    if (!pos) return "mc";
    if (pos === "goalkeeper") return "gk";
    if (pos === "back") return "df";
    if (pos === "midfielder") return "mc";
    return "fw"; // winger, striker
  };

  const categories = [
    { key: "gk", label: "Portero", metricId: "cleanSheetRatio", metricLabel: "P. Cero", unit: "%" },
    { key: "df", label: "Defensa", metricId: "impact", metricLabel: "+/- Imp.", unit: "" },
    { key: "mc", label: "Centrocampista", metricId: "impact", metricLabel: "+/- Imp.", unit: "" },
    { key: "fw", label: "Delantero / Extremo", metricId: "goals", metricLabel: "Goles", unit: "" },
  ];

  // Separate my team's players vs opponent players
  const myTeamPlayers = rows.filter((r) => normalizeTeamName(r.details?.team_name) === cleanMyTeam);
  
  // Determine our active league/competition to avoid suggesting players from other leagues
  const myCompetition = myTeamPlayers[0]?.details?.competition || "";

  // Only suggest other players from the SAME competition as our team
  const otherPlayers = rows.filter((r) => {
    const isOtherTeam = normalizeTeamName(r.details?.team_name) !== cleanMyTeam;
    const isSameLeague = !myCompetition || r.details?.competition === myCompetition;
    return isOtherTeam && isSameLeague;
  });

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-5 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <Trophy className="h-4.5 w-4.5 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Top Jugadores {myCompetition ? `— ${myCompetition}` : "de la Liga"}
          </h3>
          <p className="text-xxs text-slate-500">
            Jugadores de la liga que superan el promedio de nuestro equipo en cada línea
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {categories.map((cat) => {
          // 1. Calculate my team average
          const myPosPlayers = myTeamPlayers.filter((p) => getPositionCategory(p.details?.position) === cat.key);
          const totalMyPosMins = myPosPlayers.reduce((sum, p) => sum + (Number(p.metrics?.minutes) || 0), 0);
          
          let myAverage = 0;
          if (myPosPlayers.length > 0) {
            const sum = myPosPlayers.reduce((acc, p) => {
              const val = Number(p.metrics?.[cat.metricId]) || 0;
              return acc + val * (Number(p.metrics?.minutes) || 1);
            }, 0);
            myAverage = parseFloat((sum / (totalMyPosMins || 1)).toFixed(1));
          }

          // 2. Find best other player
          const otherPosPlayers = otherPlayers.filter((p) => getPositionCategory(p.details?.position) === cat.key);
          
          let bestOtherPlayer: ExplorerRow | null = null;
          let bestVal = -9999;
          
          for (const p of otherPosPlayers) {
            const val = Number(p.metrics?.[cat.metricId]) || 0;
            const matches = Number(p.metrics?.matches) || 0;
            const minMatches = (cat.key === "gk" || cat.key === "df") ? 15 : 5;
            
            if (matches >= minMatches && val > bestVal) {
              bestVal = val;
              bestOtherPlayer = p;
            }
          }

          const hasTarget = bestOtherPlayer !== null && bestVal > myAverage;

          return (
            <div
              key={cat.key}
              className={`rounded-xl border p-4 flex flex-col justify-between min-h-[145px] transition-all bg-slate-900/10 ${
                hasTarget ? "border-emerald-500/20 bg-emerald-500/[0.02]" : "border-slate-800 bg-slate-900/5"
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between gap-1 border-b border-slate-900/60 pb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase truncate">
                  {cat.label}
                </span>
                <span className="text-[9px] font-mono font-bold text-slate-500 shrink-0">
                  Mi Club: {myAverage > 0 ? `${myAverage}${cat.unit}` : "—"}
                </span>
              </div>

              {/* Body */}
              {hasTarget && bestOtherPlayer ? (
                <div className="flex flex-col gap-1.5 mt-2 flex-1 justify-center">
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      onClick={() => onOpenPlayerProfile(bestOtherPlayer!.name)}
                      className="text-xs font-bold text-white hover:text-primary cursor-pointer transition-colors truncate pr-1"
                      title="Ver ficha completa"
                    >
                      {bestOtherPlayer.name}
                    </span>
                    <div className="flex flex-col items-end shrink-0">
                      <span className="text-xs font-mono font-black text-emerald-400 flex items-center gap-0.5 leading-none">
                        {bestVal}{cat.unit}
                        <ArrowUpRight className="h-3 w-3 text-emerald-400" />
                      </span>
                      <span className="text-[7.5px] font-bold text-slate-500 uppercase tracking-wider mt-0.5 select-none">
                        {cat.metricLabel}
                      </span>
                    </div>
                  </div>

                  <span className="text-[9px] text-slate-500 truncate">
                    {bestOtherPlayer.details?.team_name}
                  </span>

                  {/* Relative Gap Visual Bar */}
                  <div className="w-full bg-slate-950 rounded-full h-1 overflow-hidden border border-slate-900 mt-1">
                    <div
                      className="bg-emerald-400 h-full rounded-full"
                      style={{
                        width: `${Math.min(100, (myAverage > 0 ? (bestVal / myAverage) * 50 : 80))}%`,
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center py-4">
                  <span className="text-xxs text-slate-600 italic">Sin propuestas</span>
                </div>
              )}

              {/* Actions Footer */}
              <div className="flex items-center justify-between border-t border-slate-900/60 pt-2 mt-2 gap-1.5">
                <button
                  onClick={() => onShowTopLeague(cat.key, cat.metricId)}
                  className="flex items-center gap-0.5 text-[9px] font-bold text-slate-500 hover:text-white transition-colors uppercase"
                  title="Ver ranking completo de la liga en esta posición"
                >
                  <Trophy className="h-2.5 w-2.5 text-slate-500" />
                  <span>Ver Top 10</span>
                </button>

                {hasTarget && bestOtherPlayer && (
                  <button
                    onClick={() => onCompareWithClub(bestOtherPlayer!.name, cat.key)}
                    className="flex items-center gap-0.5 text-[9px] font-bold text-primary hover:text-white transition-all uppercase"
                    title="Comparar frente a todos los jugadores de mi club en esta posición"
                  >
                    <ArrowRightLeft className="h-2.5 w-2.5" />
                    <span>Comparar</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
export default BenchmarkingCard;
