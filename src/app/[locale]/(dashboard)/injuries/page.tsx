"use client";

import { useState, useEffect } from "react";
import { 
  HeartPulse, 
  Plus, 
  Activity, 
  Calendar, 
  ChevronRight, 
  UserPlus, 
  AlertCircle, 
  X, 
  CheckCircle2, 
  TrendingUp, 
  Sparkles,
  RefreshCcw
} from "lucide-react";
import { CustomSelect } from "@/components/ui/CustomSelect";

interface ActiveInjury {
  id: string;
  status: "active" | "readaptation";
  body_part: string;
  severity: "light" | "medium" | "severe";
  description?: string;
  logged_date?: string;
  expected_weeks?: number;
  recovery_phase?: number; // 1: Immobilization, 2: Physiotherapy, 3: Readaptation, 4: High performance test
}

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  physical_status: string;
  availability_status: string;
  active_injury?: ActiveInjury | null;
  membership?: {
    jersey_number: number | null;
  };
}

export default function InjuriesPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states for logging new injury
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [bodyPart, setBodyPart] = useState("");
  const [severity, setSeverity] = useState<"light" | "medium" | "severe">("medium");
  const [expectedWeeks, setExpectedWeeks] = useState(3);
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"active" | "readaptation">("active");

  const [saving, setSaving] = useState(false);

  // Fetch squad roster with injury info
  async function loadSquad() {
    try {
      setLoading(true);
      const res = await fetch("/api/scouting/players?team=C.D. Almazán");
      if (res.ok) {
        const data = await res.json();
        // Map scouted players into a mock format representing user squad players
        const formatted = data.map((p: any, idx: number) => {
          // Mock some injuries for demonstration so the dashboard looks loaded and alive
          let activeInjury: ActiveInjury | null = null;
          if (p.player_name.includes("ALBITRE")) {
            activeInjury = {
              id: `injury-${idx}`,
              status: "readaptation",
              body_part: "Isquiotibiales (Muslo Derecho)",
              severity: "medium",
              description: "Rotura fibrilar de grado I en el bíceps femoral.",
              logged_date: "2026-06-15",
              expected_weeks: 4,
              recovery_phase: 3,
            };
          } else if (p.player_name.includes("VAREA")) {
            activeInjury = {
              id: `injury-${idx}`,
              status: "active",
              body_part: "Tobillo (Esguince Izquierdo)",
              severity: "severe",
              description: "Esguince de grado II con afectación del ligamento lateral externo.",
              logged_date: "2026-06-22",
              expected_weeks: 6,
              recovery_phase: 2,
            };
          }

          const parts = p.player_name.split(",");
          const lastName = parts[0]?.trim() || p.player_name;
          const firstName = parts[1]?.trim() || "";

          return {
            id: p.id || `player-${idx}`,
            first_name: firstName,
            last_name: lastName,
            physical_status: activeInjury ? (activeInjury.status === "readaptation" ? "fatigued" : "injured") : "optimal",
            availability_status: activeInjury ? "questionable" : "available",
            active_injury: activeInjury,
            membership: {
              jersey_number: p.shirt_number
            }
          };
        });
        setPlayers(formatted);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSquad();
  }, []);

  // Filter injured players list
  const injuredPlayers = players.filter((p) => p.active_injury);
  const healthyPlayers = players.filter((p) => !p.active_injury);

  // Advance recovery phase
  const handleAdvancePhase = (playerId: string) => {
    setPlayers((prev) =>
      prev.map((p) => {
        if (p.id === playerId && p.active_injury) {
          const currentPhase = p.active_injury.recovery_phase || 1;
          if (currentPhase >= 4) {
            // Heal / Clear injury
            return {
              ...p,
              physical_status: "optimal",
              availability_status: "available",
              active_injury: null,
            };
          }
          return {
            ...p,
            physical_status: currentPhase + 1 >= 3 ? "fatigued" : "injured",
            active_injury: {
              ...p.active_injury,
              recovery_phase: currentPhase + 1,
              status: currentPhase + 1 >= 3 ? "readaptation" : "active",
            },
          };
        }
        return p;
      })
    );
  };

  // Clear injury completely (High Medical Release)
  const handleHealPlayer = (playerId: string) => {
    setPlayers((prev) =>
      prev.map((p) => {
        if (p.id === playerId) {
          return {
            ...p,
            physical_status: "optimal",
            availability_status: "available",
            active_injury: null,
          };
        }
        return p;
      })
    );
  };

  // Form submit for logging injury
  const handleAddInjury = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlayerId || !bodyPart) return;

    setSaving(true);
    setTimeout(() => {
      setPlayers((prev) =>
        prev.map((p) => {
          if (p.id === selectedPlayerId) {
            return {
              ...p,
              physical_status: status === "readaptation" ? "fatigued" : "injured",
              availability_status: "questionable",
              active_injury: {
                id: `injury-new-${Date.now()}`,
                status,
                body_part: bodyPart,
                severity,
                description,
                logged_date: new Date().toISOString().split("T")[0],
                expected_weeks: expectedWeeks,
                recovery_phase: status === "readaptation" ? 3 : 1,
              },
            };
          }
          return p;
        })
      );
      setSaving(false);
      setIsModalOpen(false);
      // Reset form
      setSelectedPlayerId("");
      setBodyPart("");
      setDescription("");
      setExpectedWeeks(3);
    }, 500);
  };

  const getPhaseName = (phase: number) => {
    switch (phase) {
      case 1: return "Fase 1: Inmovilización / Reposo";
      case 2: return "Fase 2: Fisioterapia / Tratamiento";
      case 3: return "Fase 3: Readaptación en Campo";
      case 4: return "Fase 4: Pruebas de Esfuerzo / Alta";
      default: return "Recuperación";
    }
  };

  const getPhaseProgress = (phase: number) => {
    switch (phase) {
      case 1: return 25;
      case 2: return 50;
      case 3: return 75;
      case 4: return 90;
      default: return 0;
    }
  };

  return (
    <div className="animate-fade-in space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Parte Médico y <span className="text-rose-500">Lesiones</span>
          </h1>
          <p className="text-slate-400 text-xs mt-0.5">
            Gestión de la enfermería del equipo, fases de rehabilitación y altas médicas.
          </p>
        </div>

        {/* Log Injury Button */}
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-xs font-black uppercase text-white rounded-xl shadow-lg shadow-rose-500/20 flex items-center gap-1.5 cursor-pointer transition-all hover:scale-102"
        >
          <Plus className="h-4 w-4" />
          <span>Registrar Lesión</span>
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card border border-white/5 rounded-2xl p-5 flex items-center justify-between shadow-lg">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Enfermería Activa</span>
            <span className="text-3xl font-black text-rose-500">{injuredPlayers.length}</span>
            <span className="text-[9px] text-slate-455">Jugadores de baja o en readaptación</span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-455 shadow-inner">
            <HeartPulse className="h-5 w-5" />
          </div>
        </div>

        <div className="glass-card border border-white/5 rounded-2xl p-5 flex items-center justify-between shadow-lg">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">En Readaptación</span>
            <span className="text-3xl font-black text-amber-500">
              {injuredPlayers.filter((p) => p.active_injury?.status === "readaptation").length}
            </span>
            <span className="text-[9px] text-slate-455">Fase de trabajo físico adaptado</span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 shadow-inner">
            <Activity className="h-5 w-5" />
          </div>
        </div>

        <div className="glass-card border border-white/5 rounded-2xl p-5 flex items-center justify-between shadow-lg">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Jugadores Disponibles</span>
            <span className="text-3xl font-black text-emerald-455">{healthyPlayers.length}</span>
            <span className="text-[9px] text-slate-455">Listos para competir</span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 shadow-inner">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Injuries Grid List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white/2 border border-white/5 rounded-3xl">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
          <p className="text-xs text-slate-500 mt-2">Cargando datos del equipo médico...</p>
        </div>
      ) : injuredPlayers.length === 0 ? (
        <div className="text-center py-20 bg-white/2 border border-white/5 rounded-3xl text-slate-500 italic text-xs shadow-xl">
          🎉 ¡Excelente noticia! No hay jugadores lesionados en la plantilla.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {injuredPlayers.map((p) => {
            const inj = p.active_injury!;
            const phase = inj.recovery_phase || 1;
            const progress = getPhaseProgress(phase);

            const severityColors = {
              light: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
              medium: "bg-amber-500/10 text-amber-500 border-amber-500/20",
              severe: "bg-rose-500/10 text-rose-500 border-rose-500/20",
            };

            const severityNames = {
              light: "Leve",
              medium: "Moderada",
              severe: "Grave",
            };

            return (
              <div key={p.id} className="glass rounded-3xl border border-white/10 p-5 shadow-xl space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  {/* Player header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-extrabold text-white">
                        {p.last_name}, {p.first_name}
                      </h3>
                      <span className="text-[10px] text-slate-500 font-bold uppercase">
                        Dorsal: {p.membership?.jersey_number ?? "—"}
                      </span>
                    </div>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${severityColors[inj.severity]}`}>
                      {severityNames[inj.severity]}
                    </span>
                  </div>

                  {/* Body Part & Description */}
                  <div className="bg-slate-950/40 p-3 rounded-2xl border border-white/5 space-y-1">
                    <div className="text-[9px] text-rose-455 font-black uppercase tracking-wider">Localización:</div>
                    <div className="text-xs font-bold text-white">{inj.body_part}</div>
                    {inj.description && (
                      <p className="text-[10px] text-slate-400 leading-normal mt-1">{inj.description}</p>
                    )}
                  </div>

                  {/* Timeline progress indicator */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between items-center text-[9px] font-black uppercase">
                      <span className="text-slate-455">{getPhaseName(phase)}</span>
                      <span className="text-primary">{progress}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-900 border border-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                    </div>
                    <div className="text-[8px] text-slate-500 font-bold flex items-center gap-1.5 pt-0.5">
                      <Calendar className="h-2.5 w-2.5" />
                      <span>Registrado el {inj.logged_date} • Estimado: {inj.expected_weeks} semanas</span>
                    </div>
                  </div>
                </div>

                {/* Actions bottom bar */}
                <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                  <button
                    onClick={() => handleAdvancePhase(p.id)}
                    className="flex-1 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 border border-primary/20 text-[10px] font-black text-primary uppercase rounded-xl cursor-pointer transition-colors text-center"
                  >
                    {phase >= 4 ? "Dar de Alta Médica" : "Avanzar Fase"}
                  </button>
                  <button
                    onClick={() => handleHealPlayer(p.id)}
                    className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/25 border border-emerald-500/20 text-[10px] font-black text-emerald-455 uppercase rounded-xl cursor-pointer transition-colors"
                    title="Alta Médica Inmediata"
                  >
                    Alta Directa
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* REGISTRAR LESIÓN MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="glass rounded-3xl border border-white/10 w-full max-w-md p-6 bg-slate-900/90 shadow-2xl relative space-y-4">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="border-b border-white/5 pb-2">
              <h2 className="text-base font-extrabold text-white flex items-center gap-1.5">
                <HeartPulse className="h-5 w-5 text-rose-500" />
                Registrar Parte de Lesión
              </h2>
              <p className="text-[10px] text-slate-500 mt-0.5">Asigna una baja médica o readaptación a un jugador.</p>
            </div>

            <form onSubmit={handleAddInjury} className="space-y-4 text-xs">
              {/* Select Player */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Jugador:</label>
                <CustomSelect
                  value={selectedPlayerId}
                  onChange={setSelectedPlayerId}
                  options={[
                    { value: "", label: "Seleccionar jugador..." },
                    ...healthyPlayers.map((hp) => ({ value: hp.id, label: `${hp.last_name}, ${hp.first_name}` }))
                  ]}
                  className="w-full"
                />
              </div>

              {/* Body Part */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Localización / Zona:</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Isquiotibiales (Muslo Derecho), Tobillo Izq..."
                  value={bodyPart}
                  onChange={(e) => setBodyPart(e.target.value)}
                  className="w-full rounded-xl bg-slate-905 border border-white/5 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-rose-500/50"
                />
              </div>

              {/* Status and Severity side-by-side */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Estado Inicial:</label>
                  <CustomSelect
                    value={status}
                    onChange={(val: string) => setStatus(val as any)}
                    options={[
                      { value: "active", label: "Baja Médica" },
                      { value: "readaptation", label: "Readaptación" },
                    ]}
                    className="w-full"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Gravedad:</label>
                  <CustomSelect
                    value={severity}
                    onChange={(val: string) => setSeverity(val as any)}
                    options={[
                      { value: "light", label: "Leve" },
                      { value: "medium", label: "Moderada" },
                      { value: "severe", label: "Grave" },
                    ]}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Expected Weeks */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Estimado (Semanas):</label>
                <input
                  type="number"
                  required
                  min={1}
                  max={52}
                  value={expectedWeeks}
                  onChange={(e) => setExpectedWeeks(parseInt(e.target.value) || 1)}
                  className="w-full rounded-xl bg-slate-905 border border-white/5 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-rose-500/50"
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Descripción / Detalles:</label>
                <textarea
                  placeholder="Detalles clínicos o notas de rehabilitación..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl bg-slate-905 border border-white/5 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-rose-500/50 resize-none"
                />
              </div>

              {/* Submit */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-[10px] font-black uppercase text-slate-300 rounded-xl cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || !selectedPlayerId || !bodyPart}
                  className="flex-1 py-2 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-[10px] font-black uppercase text-white rounded-xl cursor-pointer transition-colors shadow-lg shadow-rose-500/20"
                >
                  {saving ? "Guardando..." : "Guardar Registro"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
