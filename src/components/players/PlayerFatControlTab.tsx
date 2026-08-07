"use client";

import { useState, useEffect } from "react";
import { 
  Activity, 
  TrendingDown, 
  TrendingUp, 
  Plus, 
  Trash2, 
  AlertCircle, 
  Scale, 
  Calendar, 
  Award, 
  FileSpreadsheet, 
  HelpCircle,
  Info,
  CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface PlayerFatControlTabProps {
  player: any;
}

export function PlayerFatControlTab({ player }: PlayerFatControlTabProps) {
  const [entries, setEntries] = useState<any[]>([]);
  const [percentileInfo, setPercentileInfo] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [formWeight, setFormWeight] = useState<string>(player.weight_kg ? String(player.weight_kg) : "");
  const [formTriceps, setFormTriceps] = useState<string>("");
  const [formSubescapular, setFormSubescapular] = useState<string>("");
  const [formBiceps, setFormBiceps] = useState<string>("");
  const [formAbdominal, setFormAbdominal] = useState<string>("");
  const [formIliaco, setFormIliaco] = useState<string>("");
  const [formPierna, setFormPierna] = useState<string>("");
  const [formNotes, setFormNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadBodyFatData();
  }, [player.id]);

  async function loadBodyFatData() {
    try {
      setLoading(true);
      const res = await fetch(`/api/performance/body-fat?playerId=${player.id}`);
      const data = await res.json();

      if (res.ok && data.entries) {
        setEntries(data.entries);
        setPercentileInfo(data.squadPercentileInfo);
      }
    } catch (err) {
      console.error("Error loading body fat data:", err);
    } finally {
      setLoading(false);
    }
  }

  // Live calculation helpers
  const triVal = parseFloat(formTriceps) || 0;
  const subVal = parseFloat(formSubescapular) || 0;
  const bicVal = parseFloat(formBiceps) || 0;
  const abdVal = parseFloat(formAbdominal) || 0;
  const iliVal = parseFloat(formIliaco) || 0;
  const pieVal = parseFloat(formPierna) || 0;

  const liveSumatorio = Math.round((triVal + subVal + bicVal + abdVal + iliVal + pieVal) * 10) / 10;
  const liveFat6 = liveSumatorio > 0 ? Math.round((0.1051 * liveSumatorio + 2.58) * 100) / 100 : 0;
  const liveSum4 = Math.round((triVal + subVal + abdVal + iliVal) * 10) / 10;
  const liveFat4 = liveSum4 > 0 ? Math.round((0.1051 * liveSum4 + 2.58) * 100) / 100 : 0;

  async function handleCreateEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!formDate) return;

    try {
      setSubmitting(true);
      const res = await fetch("/api/performance/body-fat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: player.id,
          date: formDate,
          weight_kg: formWeight,
          triceps_mm: formTriceps,
          subescapular_mm: formSubescapular,
          biceps_mm: formBiceps,
          abdominal_mm: formAbdominal,
          iliaco_mm: formIliaco,
          pierna_mm: formPierna,
          notes: formNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al registrar control");

      setShowAddModal(false);
      resetForm();
      await loadBodyFatData();
    } catch (err: any) {
      alert(err.message || "Error al guardar el control de grasa");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteEntry(id: string) {
    if (!confirm("¿Eliminar este registro de control de grasa?")) return;
    try {
      setDeletingId(id);
      const res = await fetch(`/api/performance/body-fat?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        await loadBodyFatData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  }

  function resetForm() {
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormTriceps("");
    setFormSubescapular("");
    setFormBiceps("");
    setFormAbdominal("");
    setFormIliaco("");
    setFormPierna("");
    setFormNotes("");
  }

  const latestEntry = entries[0];
  const previousEntry = entries[1];

  let fatDiff = null;
  let weightDiff = null;
  if (latestEntry && previousEntry) {
    fatDiff = Math.round((latestEntry.fat_percentage_6 - previousEntry.fat_percentage_6) * 100) / 100;
    if (latestEntry.weight_kg && previousEntry.weight_kg) {
      weightDiff = Math.round((latestEntry.weight_kg - previousEntry.weight_kg) * 100) / 100;
    }
  }

  // Dual chart dataset (reverse chronological -> chronological)
  const chartData = [...entries].reverse();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card rounded-xl border border-border p-5">
        <div>
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Activity className="size-4 text-emerald-400" />
            <span>Control de Grasa Corporal & Antropometría ISAK</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Evaluación de los 6 pliegues cutáneos estándar, cálculo Yuhasz y evolución del peso a la par
          </p>
        </div>

        <Button
          onClick={() => setShowAddModal(true)}
          size="sm"
          className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold gap-1.5 shrink-0 cursor-pointer shadow-md"
        >
          <Plus className="size-4" />
          Registrar Control de Grasa
        </Button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-muted-foreground animate-pulse bg-card rounded-xl border border-border">
          Cargando datos antropométricos del futbolista...
        </div>
      ) : entries.length === 0 ? (
        <div className="p-12 text-center bg-card rounded-xl border border-border space-y-3">
          <Scale className="size-8 text-muted-foreground mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">Sin registros de grasa corporal</h3>
            <p className="text-xs text-muted-foreground">
              Haz clic en "Registrar Control de Grasa" para añadir la primera medición antropométrica de {player.first_name}.
            </p>
          </div>
          <Button
            onClick={() => setShowAddModal(true)}
            size="sm"
            className="bg-primary text-primary-foreground font-semibold gap-1.5 cursor-pointer"
          >
            <Plus className="size-3.5" />
            Registrar Primer Control
          </Button>
        </div>
      ) : (
        <>
          {/* Key Metric Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Metric 1: Percentile Indicator */}
            <div className="bg-card rounded-xl border border-border p-4 space-y-2">
              <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider block">
                Percentil en la Plantilla
              </span>
              {percentileInfo ? (
                <div className="space-y-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-bold font-mono text-emerald-400">
                      P{percentileInfo.percentile}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-medium">
                      Puesto #{percentileInfo.rank} de {percentileInfo.totalSquad}
                    </span>
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden border border-border/40">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${percentileInfo.percentile}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground italic pt-0.5">
                    Más magro que el {percentileInfo.percentile}% del equipo (Media: {percentileInfo.teamAverageFat}%)
                  </p>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground italic py-2">Sin datos comparativos aún</div>
              )}
            </div>

            {/* Metric 2: Último Porcentaje de Grasa (6 Pliegues Yuhasz) */}
            <div className="bg-card rounded-xl border border-border p-4 space-y-2">
              <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider block">
                % Grasa (6 Pliegues Yuhasz)
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold font-mono text-foreground">
                  {latestEntry.fat_percentage_6}%
                </span>
                {fatDiff !== null && (
                  <span
                    className={cn(
                      "text-xs font-semibold px-2 py-0.5 rounded flex items-center gap-0.5",
                      fatDiff < 0
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : fatDiff > 0
                        ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {fatDiff < 0 ? <TrendingDown className="size-3" /> : fatDiff > 0 ? <TrendingUp className="size-3" /> : null}
                    {fatDiff > 0 ? `+${fatDiff}%` : `${fatDiff}%`}
                  </span>
                )}
              </div>
              <div className="text-[10px] text-muted-foreground flex justify-between">
                <span>Sumatorio: <strong className="text-foreground">{latestEntry.sumatorio_mm} mm</strong></span>
                <span>4 Pliegues: <strong className="text-foreground">{latestEntry.fat_percentage_4}%</strong></span>
              </div>
            </div>

            {/* Metric 3: Último Peso Registrado (a la par) */}
            <div className="bg-card rounded-xl border border-border p-4 space-y-2">
              <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider block">
                Último Peso Registrado
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold font-mono text-sky-400">
                  {latestEntry.weight_kg ? `${latestEntry.weight_kg} kg` : `${player.weight_kg || "--"} kg`}
                </span>
                {weightDiff !== null && (
                  <span
                    className={cn(
                      "text-xs font-semibold px-2 py-0.5 rounded flex items-center gap-0.5",
                      weightDiff < 0
                        ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                        : weightDiff > 0
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {weightDiff > 0 ? `+${weightDiff} kg` : `${weightDiff} kg`}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground italic">
                Evaluado el {latestEntry.date}
              </p>
            </div>

            {/* Metric 4: ISAK Summary */}
            <div className="bg-card rounded-xl border border-border p-4 space-y-2">
              <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider block">
                Protocolo ISAK 6 Pliegues
              </span>
              <div className="text-xs space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">Tríceps + Subesp.:</span>
                  <span className="font-semibold text-foreground">{latestEntry.triceps_mm} + {latestEntry.subescapular_mm} mm</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">Abdo + Ilíaco:</span>
                  <span className="font-semibold text-foreground">{latestEntry.abdominal_mm} + {latestEntry.iliaco_mm} mm</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">Bíceps + Pierna:</span>
                  <span className="font-semibold text-foreground">{latestEntry.biceps_mm} + {latestEntry.pierna_mm} mm</span>
                </div>
              </div>
            </div>
          </div>

          {/* Dual Evolution Chart (Grasa y Peso a la Par) */}
          <div className="bg-card rounded-xl border border-border p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp className="size-4 text-emerald-400" />
                  <span>Evolución Temporal de Grasa Corporal (% Yuhasz) y Peso (kg)</span>
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Seguimiento conjunto para evaluar composición corporal sin perder masa magra
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs font-medium">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 inline-block" />
                  % Grasa (6 Pliegues)
                </span>
                <span className="flex items-center gap-1.5 text-sky-400">
                  <span className="h-2.5 w-2.5 rounded-full bg-sky-400 inline-block" />
                  Peso (kg)
                </span>
              </div>
            </div>

            {/* Custom SVG Dual Line Chart */}
            {chartData.length > 0 && (
              <div className="relative h-64 w-full bg-muted/20 rounded-lg p-4 border border-border/50">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 500 200" preserveAspectRatio="none">
                  {/* Grid Lines */}
                  <line x1="0" y1="40" x2="500" y2="40" stroke="currentColor" className="text-border/40" strokeDasharray="4 4" />
                  <line x1="0" y1="100" x2="500" y2="100" stroke="currentColor" className="text-border/40" strokeDasharray="4 4" />
                  <line x1="0" y1="160" x2="500" y2="160" stroke="currentColor" className="text-border/40" strokeDasharray="4 4" />

                  {(() => {
                    const minFat = Math.min(...chartData.map(d => d.fat_percentage_6)) - 1;
                    const maxFat = Math.max(...chartData.map(d => d.fat_percentage_6)) + 1;
                    const fatRange = maxFat - minFat || 1;

                    const weights = chartData.map(d => d.weight_kg || player.weight_kg || 70);
                    const minW = Math.min(...weights) - 2;
                    const maxW = Math.max(...weights) + 2;
                    const wRange = maxW - minW || 1;

                    const getX = (i: number) => {
                      if (chartData.length === 1) return 250;
                      return 30 + (i / (chartData.length - 1)) * 440;
                    };

                    const getFatY = (fat: number) => {
                      return 170 - ((fat - minFat) / fatRange) * 140;
                    };

                    const getWY = (w: number) => {
                      return 170 - ((w - minW) / wRange) * 140;
                    };

                    const fatPoints = chartData.map((d, i) => `${getX(i)},${getFatY(d.fat_percentage_6)}`).join(" ");
                    const wPoints = chartData.map((d, i) => `${getX(i)},${getWY(d.weight_kg || player.weight_kg || 70)}`).join(" ");

                    return (
                      <>
                        {/* Line % Fat */}
                        <polyline
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="3"
                          points={fatPoints}
                        />

                        {/* Line Weight */}
                        <polyline
                          fill="none"
                          stroke="#38bdf8"
                          strokeWidth="2.5"
                          strokeDasharray="6 3"
                          points={wPoints}
                        />

                        {/* Data Points */}
                        {chartData.map((d, i) => {
                          const cx = getX(i);
                          const cyFat = getFatY(d.fat_percentage_6);
                          const cyW = getWY(d.weight_kg || player.weight_kg || 70);
                          return (
                            <g key={d.id || i}>
                              {/* Fat Point */}
                              <circle cx={cx} cy={cyFat} r="4" fill="#10b981" stroke="#022c22" strokeWidth="2" />
                              <text x={cx} y={cyFat - 8} textAnchor="middle" fill="#10b981" fontSize="10" fontWeight="bold">
                                {d.fat_percentage_6}%
                              </text>

                              {/* Weight Point */}
                              <circle cx={cx} cy={cyW} r="3.5" fill="#38bdf8" stroke="#0c4a6e" strokeWidth="2" />
                              <text x={cx} y={cyW + 14} textAnchor="middle" fill="#38bdf8" fontSize="9">
                                {d.weight_kg ? `${d.weight_kg}kg` : ""}
                              </text>
                            </g>
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>
              </div>
            )}
          </div>

          {/* Desglose ISAK de los 6 Pliegues (Última Medición) */}
          <div className="bg-card rounded-xl border border-border p-6 space-y-4">
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
              <FileSpreadsheet className="size-4 text-emerald-400" />
              <span>Desglose de los 6 Pliegues Cutáneos ISAK (Última Medición)</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 font-mono text-xs">
              <div className="p-3 rounded-lg bg-muted/40 border border-border/50 text-center space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-sans font-semibold block">TRICEPS</span>
                <span className="text-base font-bold text-foreground">{latestEntry.triceps_mm} <span className="text-[10px] font-sans text-muted-foreground">mm</span></span>
                <span className="text-[9px] text-muted-foreground font-sans block">Pliegue Tricipital</span>
              </div>

              <div className="p-3 rounded-lg bg-muted/40 border border-border/50 text-center space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-sans font-semibold block">SUBES.</span>
                <span className="text-base font-bold text-foreground">{latestEntry.subescapular_mm} <span className="text-[10px] font-sans text-muted-foreground">mm</span></span>
                <span className="text-[9px] text-muted-foreground font-sans block">Subescapular</span>
              </div>

              <div className="p-3 rounded-lg bg-muted/40 border border-border/50 text-center space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-sans font-semibold block">BICEPS</span>
                <span className="text-base font-bold text-foreground">{latestEntry.biceps_mm} <span className="text-[10px] font-sans text-muted-foreground">mm</span></span>
                <span className="text-[9px] text-muted-foreground font-sans block">Pliegue Bicipital</span>
              </div>

              <div className="p-3 rounded-lg bg-muted/40 border border-border/50 text-center space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-sans font-semibold block">ABDO.</span>
                <span className="text-base font-bold text-foreground">{latestEntry.abdominal_mm} <span className="text-[10px] font-sans text-muted-foreground">mm</span></span>
                <span className="text-[9px] text-muted-foreground font-sans block">Abdominal</span>
              </div>

              <div className="p-3 rounded-lg bg-muted/40 border border-border/50 text-center space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-sans font-semibold block">ILIACO</span>
                <span className="text-base font-bold text-foreground">{latestEntry.iliaco_mm} <span className="text-[10px] font-sans text-muted-foreground">mm</span></span>
                <span className="text-[9px] text-muted-foreground font-sans block">Suprailíaco</span>
              </div>

              <div className="p-3 rounded-lg bg-muted/40 border border-border/50 text-center space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-sans font-semibold block">PIER.</span>
                <span className="text-base font-bold text-foreground">{latestEntry.pierna_mm} <span className="text-[10px] font-sans text-muted-foreground">mm</span></span>
                <span className="text-[9px] text-muted-foreground font-sans block">Pierna / Gemelo</span>
              </div>
            </div>
          </div>

          {/* Historical Data Table */}
          <div className="bg-card rounded-xl border border-border p-6 space-y-4">
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
              <Calendar className="size-4 text-emerald-400" />
              <span>Histórico Registrado de Evaluaciones Antropométricas ({entries.length})</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] border-b border-border">
                  <tr>
                    <th className="p-2.5">Fecha</th>
                    <th className="p-2.5">Peso (kg)</th>
                    <th className="p-2.5">Tríceps</th>
                    <th className="p-2.5">Subes.</th>
                    <th className="p-2.5">Bíceps</th>
                    <th className="p-2.5">Abdo.</th>
                    <th className="p-2.5">Ilíaco</th>
                    <th className="p-2.5">Pier.</th>
                    <th className="p-2.5 text-emerald-400">Sumatorio</th>
                    <th className="p-2.5 font-bold text-emerald-400">6 PLIE. (% Yuhasz)</th>
                    <th className="p-2.5">4 PLIE. (%)</th>
                    <th className="p-2.5">Notas</th>
                    <th className="p-2.5 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  {entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-2.5 font-bold text-foreground font-sans">{entry.date}</td>
                      <td className="p-2.5 font-bold text-sky-400">{entry.weight_kg ? `${entry.weight_kg} kg` : "–"}</td>
                      <td className="p-2.5">{entry.triceps_mm}</td>
                      <td className="p-2.5">{entry.subescapular_mm}</td>
                      <td className="p-2.5">{entry.biceps_mm}</td>
                      <td className="p-2.5">{entry.abdominal_mm}</td>
                      <td className="p-2.5">{entry.iliaco_mm}</td>
                      <td className="p-2.5">{entry.pierna_mm}</td>
                      <td className="p-2.5 font-bold text-emerald-400">{entry.sumatorio_mm} mm</td>
                      <td className="p-2.5 font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded w-fit">
                        {entry.fat_percentage_6}%
                      </td>
                      <td className="p-2.5">{entry.fat_percentage_4}%</td>
                      <td className="p-2.5 text-muted-foreground italic font-sans truncate max-w-[150px]">
                        {entry.notes || "–"}
                      </td>
                      <td className="p-2.5 text-right">
                        <button
                          onClick={() => handleDeleteEntry(entry.id)}
                          disabled={deletingId === entry.id}
                          className="text-muted-foreground hover:text-destructive transition-colors p-1 cursor-pointer"
                          title="Eliminar registro"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* MODAL: REGISTRAR CONTROL DE GRASA */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateEntry}
            className="bg-card border border-border shadow-2xl w-full max-w-xl rounded-xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Plus className="size-4 text-emerald-400" />
                Registrar Control de Grasa — {player.first_name} {player.last_name}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-muted-foreground hover:text-foreground text-lg font-bold cursor-pointer"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              {/* Date & Weight */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">
                    Fecha de Evaluación *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full rounded-md bg-muted border border-border px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">
                    Peso del Jugador (kg)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="ej. 74.5"
                    value={formWeight}
                    onChange={(e) => setFormWeight(e.target.value)}
                    className="w-full rounded-md bg-muted border border-border px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* 6 Skinfolds Inputs ISAK */}
              <div>
                <label className="block text-[11px] font-bold text-emerald-400 uppercase mb-2 tracking-wider">
                  6 Pliegues Cutáneos en Milímetros (ISAK)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-[10px] text-muted-foreground font-semibold block mb-1">TRICEPS (Tricipital)</span>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="mm"
                      value={formTriceps}
                      onChange={(e) => setFormTriceps(e.target.value)}
                      className="w-full rounded-md bg-muted border border-border px-3 py-1.5 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <span className="text-[10px] text-muted-foreground font-semibold block mb-1">SUBES. (Subescapular)</span>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="mm"
                      value={formSubescapular}
                      onChange={(e) => setFormSubescapular(e.target.value)}
                      className="w-full rounded-md bg-muted border border-border px-3 py-1.5 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <span className="text-[10px] text-muted-foreground font-semibold block mb-1">BICEPS (Bicipital)</span>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="mm"
                      value={formBiceps}
                      onChange={(e) => setFormBiceps(e.target.value)}
                      className="w-full rounded-md bg-muted border border-border px-3 py-1.5 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <span className="text-[10px] text-muted-foreground font-semibold block mb-1">ABDO. (Abdominal)</span>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="mm"
                      value={formAbdominal}
                      onChange={(e) => setFormAbdominal(e.target.value)}
                      className="w-full rounded-md bg-muted border border-border px-3 py-1.5 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <span className="text-[10px] text-muted-foreground font-semibold block mb-1">ILIACO (Suprailíaco)</span>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="mm"
                      value={formIliaco}
                      onChange={(e) => setFormIliaco(e.target.value)}
                      className="w-full rounded-md bg-muted border border-border px-3 py-1.5 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <span className="text-[10px] text-muted-foreground font-semibold block mb-1">PIER. (Pierna/Gemelo)</span>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="mm"
                      value={formPierna}
                      onChange={(e) => setFormPierna(e.target.value)}
                      className="w-full rounded-md bg-muted border border-border px-3 py-1.5 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Real-time Calculation Preview Box */}
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3.5 space-y-2">
                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">
                  Cálculo Automático en Tiempo Real
                </span>
                <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                  <div>
                    <span className="text-[9px] text-muted-foreground block font-sans">SUMATORIO</span>
                    <span className="font-bold text-foreground text-sm">{liveSumatorio} mm</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-emerald-400 font-bold block font-sans">6 PLIEGUES (Yuhasz)</span>
                    <span className="font-bold text-emerald-400 text-sm">{liveFat6}%</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-muted-foreground block font-sans">4 PLIEGUES</span>
                    <span className="font-bold text-foreground text-sm">{liveFat4}%</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">
                  Notas / Observaciones del Preparador
                </label>
                <textarea
                  rows={2}
                  placeholder="Comentarios adicionales..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full rounded-md bg-muted border border-border px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAddModal(false)}
                className="cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                size="sm"
                className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold cursor-pointer"
              >
                {submitting ? "Guardando..." : "Guardar Control de Grasa"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
