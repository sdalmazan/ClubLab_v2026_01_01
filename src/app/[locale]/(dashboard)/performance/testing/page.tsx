"use client";

import { useState, useEffect } from "react";
import { PerformanceSubNav } from "@/components/performance/PerformanceSubNav";
import { Target, Award, ArrowUpRight, CheckCircle2, Settings, Zap, Plus, Activity, User, TrendingUp, X, Sparkles, Medal, ListFilter } from "lucide-react";
import Link from "next/link";

interface ActiveTest {
  id: string;
  name: string;
  category: string | null;
  unit: string | null;
  higher_is_better: boolean;
  is_active: boolean;
  description?: string | null;
}

interface PlayerTestResult {
  id: string;
  playerId: string;
  playerName: string;
  position: string;
  value: number;
  date: string;
  historical: { date: string; value: number }[];
}

export default function TestingPerformancePage() {
  const [activeTests, setActiveTests] = useState<ActiveTest[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected player evolution modal state
  const [selectedPlayerResult, setSelectedPlayerResult] = useState<{
    player: PlayerTestResult;
    test: ActiveTest;
    quartileLabel: string;
    rankIndex: number;
    totalPlayers: number;
  } | null>(null);

  // Expanded complete test modal state
  const [expandedTest, setExpandedTest] = useState<{ test: ActiveTest; results: PlayerTestResult[] } | null>(null);
  const [searchPlayer, setSearchPlayer] = useState("");
  const [fatResults, setFatResults] = useState<PlayerTestResult[]>([]);

  useEffect(() => {
    async function loadActiveTests() {
      try {
        setLoading(true);
        const [res, fatRes] = await Promise.all([
          fetch("/api/performance/tests?activeOnly=true"),
          fetch("/api/performance/body-fat?limit=500")
        ]);

        if (fatRes.ok) {
          const fatData = await fatRes.json();
          if (fatData.entries) {
            const playerMap = new Map<string, PlayerTestResult>();
            fatData.entries.forEach((entry: any) => {
              if (!playerMap.has(entry.player_id)) {
                playerMap.set(entry.player_id, {
                  id: entry.id,
                  playerId: entry.player_id,
                  playerName: entry.players ? `${entry.players.first_name} ${entry.players.last_name}` : "Desconocido",
                  position: "JUG",
                  value: entry.fat_percentage_6,
                  date: entry.date,
                  historical: []
                });
              }
              playerMap.get(entry.player_id)!.historical.push({
                date: entry.date,
                value: entry.fat_percentage_6
              });
            });

            const results = Array.from(playerMap.values()).map(r => {
              r.historical.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
              return r;
            });

            results.sort((a, b) => a.value - b.value);
            setFatResults(results);
          }
        }

        const data = await res.json();
        if (res.ok && Array.isArray(data)) {
          let list = [...data];
          const hasSkinfolds = list.some(
            (t) => t.id === "t-skinfolds" || t.name?.toLowerCase().includes("antropometría") || t.name?.toLowerCase().includes("pliegues")
          );

          if (!hasSkinfolds) {
            list.unshift({
              id: "t-skinfolds",
              name: "Antropometría — 6 Pliegues Cutáneos ISAK (% Grasa)",
              category: "Composición Corporal",
              unit: "%",
              higher_is_better: false,
              is_active: true,
              description: "Suma de 6 pliegues (Tríceps, Subescapular, Supraespinal, Abdominal, Muslo, Pierna Medial). Cálculo de % grasa corporal Yuhasz/Faulkner."
            });
          }

          setActiveTests(list);
        }
      } catch (err) {
        console.error("Error loading active tests:", err);
      } finally {
        setLoading(false);
      }
    }
    loadActiveTests();
  }, []);

  // Results dataset per test type
  const getResultsForTest = (test: ActiveTest): PlayerTestResult[] => {
    if (test.id === "t-skinfolds" || test.name?.toLowerCase().includes("pliegues") || test.name?.toLowerCase().includes("antropometría")) {
      return fatResults;
    }
    return [];
  };

  const getValueStyle = (testId: string, value: number) => {
    if (testId === "t-skinfolds" || testId.includes("skinfolds")) {
      if (value > 10) return "text-red-500 bg-red-500/20 px-2 py-1 rounded font-black border border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.5)]";
      if (value > 8) return "text-red-400 font-extrabold";
      if (value >= 7) return "text-blue-400 font-extrabold";
      return "text-green-400 font-extrabold";
    }
    return "corp-text font-extrabold";
  };


  // Helper for statistical quartiles
  const getQuartileBadge = (rankIndex: number, total: number) => {
    const percentile = ((total - rankIndex) / total) * 100;
    if (percentile >= 75) {
      return { label: "Q4 — Élite (Top 25%)", bg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" };
    }
    if (percentile >= 50) {
      return { label: "Q3 — Sobre Media", bg: "bg-cyan-500/10 border-cyan-500/30 text-cyan-400" };
    }
    if (percentile >= 25) {
      return { label: "Q2 — Bajo Media", bg: "bg-amber-500/10 border-amber-500/30 text-amber-400" };
    }
    return { label: "Q1 — En Atención", bg: "bg-rose-500/10 border-rose-500/30 text-rose-400" };
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8 text-slate-100">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl flex items-center gap-2.5">
            <Zap className="h-7 w-7 corp-text" />
            Centro de Testing & Biometría
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Evaluación dinámica de capacidades biomotoras, top 5 marcas por test y desglose completo por plantilla.
          </p>
        </div>

        <Link
          href="/performance/settings"
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 border border-slate-800 px-4 py-2 text-xs font-bold text-slate-200 hover:text-white hover:bg-slate-850 transition-all shadow-md w-fit cursor-pointer"
        >
          <Settings className="h-4 w-4 corp-text" />
          Añadir / Quitar Tests en Ajustes
        </Link>
      </div>

      <PerformanceSubNav />

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-400" />
          <p className="text-xs text-slate-500 mt-2">Cargando batería de tests activos...</p>
        </div>
      ) : activeTests.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-12 text-center space-y-4">
          <Activity className="h-10 w-10 corp-text mx-auto opacity-50" />
          <h3 className="text-base font-bold text-white">No hay tests físicos activos en el club</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Ve a la pantalla de Ajustes de Rendimiento para activar los tests que utilizará el preparador físico o añade nuevos protocolos personalizados.
          </p>
          <Link
            href="/performance/settings"
            className="inline-flex items-center gap-2 rounded-xl btn-corporate text-white px-5 py-2.5 text-xs font-extrabold transition-all shadow-lg cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Configurar Batería de Tests en Ajustes
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {activeTests.map((test) => {
            const results = getResultsForTest(test);
            const top5Results = results.slice(0, 5);

            return (
              <div
                key={test.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4 shadow-lg hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Test Card Header */}
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-white">{test.name}</span>
                        <span className="text-[10px] font-bold corp-badge px-2 py-0.5 rounded">
                          {test.unit || "unidades"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Criterio: {test.higher_is_better ? "Mayor valor es mejor (▲)" : "Menor tiempo es mejor (▼)"}
                      </p>
                    </div>

                    <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300">
                      <Medal className="h-5 w-5 corp-text" />
                    </div>
                  </div>

                  {/* Top 5 Player Leaderboard List */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Top 5 Jugadores (Mejores Marcas)
                    </span>

                    {top5Results.map((res, rankIdx) => {
                      const qInfo = getQuartileBadge(rankIdx, results.length);

                      return (
                        <div
                          key={res.id}
                          onClick={() =>
                            setSelectedPlayerResult({
                              player: res,
                              test,
                              quartileLabel: qInfo.label,
                              rankIndex: rankIdx + 1,
                              totalPlayers: results.length,
                            })
                          }
                          className="rounded-xl bg-slate-950/80 border border-slate-800 p-3 flex items-center justify-between hover:border-slate-700 hover:bg-slate-900 cursor-pointer transition-all group"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`h-6 w-6 rounded-lg text-[11px] font-bold flex items-center justify-center ${
                                rankIdx === 0
                                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                  : rankIdx === 1
                                  ? "bg-slate-300/20 text-slate-200 border border-slate-300/40"
                                  : rankIdx === 2
                                  ? "bg-amber-700/20 text-amber-400 border border-amber-700/40"
                                  : "bg-slate-800 text-slate-400"
                              }`}
                            >
                              #{rankIdx + 1}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-xs group-hover:corp-text transition-colors">
                                  {res.playerName}
                                </span>
                                <span className="text-[10px] font-semibold text-slate-500">
                                  {res.position}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono">
                                Evaluado: {res.date}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 text-right">
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${qInfo.bg}`}>
                              {qInfo.label.split("—")[0]}
                            </span>
                            <div className={`font-mono text-sm ${getValueStyle(test.id, res.value)}`}>
                              {res.value} <span className="text-[10px] font-normal opacity-70">{test.unit}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Per-Test Complete Results Trigger Button */}
                <button
                  type="button"
                  onClick={() => setExpandedTest({ test, results })}
                  className="w-full mt-4 py-2.5 rounded-xl btn-corporate text-white text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg"
                >
                  <ListFilter className="h-4 w-4" />
                  <span>Ver Lista Completa de Resultados ({results.length} Jugadores)</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── MODAL: LISTA COMPLETA DE RESULTADOS DE UN TEST ESPECÍFICO ── */}
      {expandedTest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 space-y-4 shadow-2xl text-white max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  <Zap className="h-5 w-5 corp-text" />
                  Resultados Completos: {expandedTest.test.name}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Criterio: {expandedTest.test.higher_is_better ? "Mayor valor es mejor (▲)" : "Menor tiempo es mejor (▼)"} | Unidad: {expandedTest.test.unit}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setExpandedTest(null);
                  setSearchPlayer("");
                }}
                className="text-slate-400 hover:text-white p-1 text-lg font-bold cursor-pointer"
              >
                ×
              </button>
            </div>

            <div className="flex items-center justify-between gap-4">
              <input
                type="text"
                placeholder="Filtrar por nombre de jugador..."
                value={searchPlayer}
                onChange={(e) => setSearchPlayer(e.target.value)}
                className="w-full sm:w-64 rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
              />
              <span className="text-xs text-slate-400 font-mono">
                {expandedTest.results.length} evaluaciones registradas
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="border-b border-slate-800 text-[10px] uppercase font-bold text-slate-500 bg-slate-950/60">
                  <tr>
                    <th className="py-2.5 px-3">Posición / Ranking</th>
                    <th className="py-2.5 px-3">Jugador</th>
                    <th className="py-2.5 px-3">Marca Registrada</th>
                    <th className="py-2.5 px-3">Cuartil Estadístico</th>
                    <th className="py-2.5 px-3">Fecha Evaluación</th>
                    <th className="py-2.5 px-3 text-right">Evolución</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {expandedTest.results
                    .filter((r) => r.playerName.toLowerCase().includes(searchPlayer.toLowerCase()))
                    .map((res, rankIdx) => {
                      const qInfo = getQuartileBadge(rankIdx, expandedTest.results.length);
                      return (
                        <tr key={res.id} className="hover:bg-slate-950/60 transition-colors">
                          <td className="py-3 px-3 font-bold text-slate-400">#{rankIdx + 1}</td>
                          <td className="py-3 px-3 font-bold text-white">
                            {res.playerName} <span className="text-[10px] text-slate-500 font-semibold uppercase">({res.position})</span>
                          </td>
                          <td className={`py-3 px-3 font-mono ${getValueStyle(expandedTest.test.id, res.value)}`}>
                            {res.value} <span className="text-[10px] font-normal opacity-70">{expandedTest.test.unit}</span>
                          </td>
                          <td className="py-3 px-3">
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded border inline-block ${qInfo.bg}`}>
                              {qInfo.label}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">{res.date}</td>
                          <td className="py-3 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setExpandedTest(null);
                                setSelectedPlayerResult({
                                  player: res,
                                  test: expandedTest.test,
                                  quartileLabel: qInfo.label,
                                  rankIndex: rankIdx + 1,
                                  totalPlayers: expandedTest.results.length,
                                });
                              }}
                              className="text-xs font-bold corp-text hover:underline cursor-pointer"
                            >
                              Ver Gráfico
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setExpandedTest(null);
                  setSearchPlayer("");
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: PLAYER TEST EVOLUTION ── */}
      {selectedPlayerResult && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 shadow-2xl w-full max-w-xl rounded-2xl p-6 space-y-5 animate-fade-in relative">
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl corp-badge">
                  <TrendingUp className="h-6 w-6 corp-text" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    {selectedPlayerResult.player.playerName} — Evolución
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Test: <strong className="text-slate-200">{selectedPlayerResult.test.name}</strong> ({selectedPlayerResult.test.unit})
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedPlayerResult(null)}
                className="text-slate-500 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Posición en Ranking</span>
                <span className="text-lg font-black text-white font-mono mt-0.5 block">
                  #{selectedPlayerResult.rankIndex} <span className="text-xs text-slate-400">/ {selectedPlayerResult.totalPlayers}</span>
                </span>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Último Resultado</span>
                <span className={`text-lg font-black font-mono mt-0.5 inline-block ${getValueStyle(selectedPlayerResult.test.id, selectedPlayerResult.player.value)}`}>
                  {selectedPlayerResult.player.value} <span className="text-xs font-normal opacity-70">{selectedPlayerResult.test.unit}</span>
                </span>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Cuartil Estadístico</span>
                <span className="text-xs font-bold corp-text mt-1.5 block">
                  {selectedPlayerResult.quartileLabel.split("—")[0]}
                </span>
              </div>
            </div>

            {/* Historical Progression Timeline */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Historial de Mediciones & Progresión
              </span>

              <div className="space-y-2 bg-slate-950/80 p-4 rounded-xl border border-slate-800">
                {selectedPlayerResult.player.historical.map((h, i) => (
                  <div key={i} className="flex justify-between items-center text-xs py-1.5 border-b border-slate-900 last:border-0">
                    <span className="text-slate-400 font-mono">{h.date}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white font-mono">
                        {h.value} {selectedPlayerResult.test.unit}
                      </span>
                      {i > 0 && (
                        <span className="text-[10px] corp-text font-bold">
                          {selectedPlayerResult.test.higher_is_better
                            ? h.value >= selectedPlayerResult.player.historical[i - 1].value ? "+▲" : "-▼"
                            : h.value <= selectedPlayerResult.player.historical[i - 1].value ? "-▲" : "+▼"}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setSelectedPlayerResult(null)}
              className="w-full rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold py-2.5 transition-all cursor-pointer"
            >
              Cerrar Vista de Evolución
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
