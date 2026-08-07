import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Activity, ArrowLeft, Plus, TrendingUp, Users, Scale, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Control de Grasa del Equipo — ClubLab",
  description: "Panel de control antropométrico y percentiles de masa grasa del equipo",
};

export default async function TeamBodyFatPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let userRole = "coach";
  let orgId = "";
  if (user) {
    const { data: roleData } = await supabase
      .from("user_organization_roles")
      .select("organization_id, role")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (roleData) {
      orgId = roleData.organization_id;
      userRole = roleData.role;
    }
  }

  // Fetch players with latest body fat entry
  const { data: players } = await supabase
    .from("players")
    .select("id, first_name, last_name, avatar_url, weight_kg")
    .eq("organization_id", orgId)
    .order("last_name", { ascending: true });

  const { data: allFatEntries } = await supabase
    .from("player_body_fat_entries")
    .select("*")
    .eq("organization_id", orgId)
    .order("date", { ascending: false });

  // Group latest fat entry per player
  const latestFatByPlayer = new Map<string, any>();
  if (allFatEntries) {
    for (const entry of allFatEntries) {
      if (!latestFatByPlayer.has(entry.player_id)) {
        latestFatByPlayer.set(entry.player_id, entry);
      }
    }
  }

  // Calculate squad percentiles
  const fatValues = Array.from(latestFatByPlayer.values()).map(e => Number(e.fat_percentage_6 || 0));
  const totalSquadMeasured = fatValues.length;
  const avgFat = totalSquadMeasured > 0 
    ? Math.round((fatValues.reduce((a, b) => a + b, 0) / totalSquadMeasured) * 10) / 10 
    : 0;

  const sortedFatValues = [...fatValues].sort((a, b) => a - b);

  const playersFatList = (players || []).map(p => {
    const latest = latestFatByPlayer.get(p.id);
    let percentile = null;
    let rank = null;

    if (latest && totalSquadMeasured > 0) {
      const fat = Number(latest.fat_percentage_6 || 0);
      const higherCount = fatValues.filter(v => v > fat).length;
      const equalCount = fatValues.filter(v => v === fat).length;
      percentile = Math.min(99, Math.max(1, Math.round(((higherCount + 0.5 * equalCount) / totalSquadMeasured) * 100)));
      rank = sortedFatValues.indexOf(fat) + 1;
    }

    return {
      player: p,
      latest,
      percentile,
      rank,
    };
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-fade-in">
      {/* Header & Back Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <Link
            href="/performance/monitoring"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft className="size-3.5" />
            <span>Volver a Monitoreo</span>
          </Link>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Scale className="size-5 text-emerald-400" />
            <span>Control de Grasa & Antropometría ISAK del Equipo</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Monitoreo global de pliegues cutáneos, masa grasa Yuhasz y peso de la plantilla
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/settings?tab=performance"
            className="text-xs bg-muted hover:bg-muted/80 text-foreground px-3 py-1.5 rounded-md border border-border transition-colors font-medium"
          >
            ⚙️ Ajustar Pliegues Medidos
          </Link>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border p-5 space-y-1">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
            Futbolistas Medidos
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-foreground">{totalSquadMeasured}</span>
            <span className="text-xs text-muted-foreground">/ {players?.length || 0} plantilla</span>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-5 space-y-1">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
            Media de Grasa (% Yuhasz 6P)
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-emerald-400">{avgFat}%</span>
            <span className="text-xs text-muted-foreground">promedio plantilla</span>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-5 space-y-1">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
            Rango del Equipo
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-sky-400">
              {sortedFatValues.length > 0 ? `${sortedFatValues[0]}% - ${sortedFatValues[sortedFatValues.length - 1]}%` : "–"}
            </span>
          </div>
        </div>
      </div>

      {/* Team Percentile & Fat Table */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
            <Users className="size-4 text-emerald-400" />
            <span>Ranking de Masa Grasa y Percentil por Jugador ({playersFatList.length})</span>
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] border-b border-border">
              <tr>
                <th className="p-3">Futbolista</th>
                <th className="p-3">Puesto / Percentil</th>
                <th className="p-3">Último Peso</th>
                <th className="p-3 font-bold text-emerald-400">6 PLIE. (% Yuhasz)</th>
                <th className="p-3">4 PLIE. (%)</th>
                <th className="p-3">Sumatorio (mm)</th>
                <th className="p-3">Última Evaluación</th>
                <th className="p-3 text-right">Ficha Jugador</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-mono">
              {playersFatList.map(({ player: p, latest, percentile, rank }) => (
                <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                  <td className="p-3 font-sans">
                    <div className="flex items-center gap-2.5">
                      {p.avatar_url ? (
                        <img src={p.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover border border-border" />
                      ) : (
                        <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center font-bold text-[10px]">
                          {p.first_name[0]}{p.last_name[0]}
                        </div>
                      )}
                      <span className="font-semibold text-foreground">{p.first_name} {p.last_name}</span>
                    </div>
                  </td>

                  <td className="p-3">
                    {percentile !== null ? (
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded text-[11px] border border-emerald-500/20">
                          P{percentile}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-sans">#{rank} de {totalSquadMeasured}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground font-sans text-[11px]">Sin medición</span>
                    )}
                  </td>

                  <td className="p-3 text-sky-400 font-bold">
                    {latest?.weight_kg ? `${latest.weight_kg} kg` : p.weight_kg ? `${p.weight_kg} kg` : "–"}
                  </td>

                  <td className="p-3">
                    {latest ? (
                      <span className="font-bold text-emerald-400 text-sm">
                        {latest.fat_percentage_6}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground">–</span>
                    )}
                  </td>

                  <td className="p-3">
                    {latest ? `${latest.fat_percentage_4}%` : "–"}
                  </td>

                  <td className="p-3 text-foreground font-bold">
                    {latest ? `${latest.sumatorio_mm} mm` : "–"}
                  </td>

                  <td className="p-3 font-sans text-muted-foreground">
                    {latest?.date || "–"}
                  </td>

                  <td className="p-3 text-right font-sans">
                    <Link
                      href={`/players/${p.id}`}
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      Ver Ficha →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
