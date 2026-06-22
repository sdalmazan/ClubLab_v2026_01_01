"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PositionSelector } from "@/components/players/FieldMap";
import type { PositionKey } from "@/types";

interface Team {
  id: string;
  name: string;
  category: string | null;
}

interface CreatePlayerFormProps {
  teams: Team[];
  defaultSeasonId: string;
  organizationId: string;
}

export function CreatePlayerForm({
  teams,
  defaultSeasonId,
  organizationId,
}: CreatePlayerFormProps) {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [nationality, setNationality] = useState("");
  const [dominantFoot, setDominantFoot] = useState<"right" | "left" | "both">("right");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [jerseyNumber, setJerseyNumber] = useState("");
  const [positions, setPositions] = useState<PositionKey[]>([]);
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!teamId) {
      setError("Selecciona un equipo");
      return;
    }
    setError(null);
    setLoading(true);

    const body = {
      organizationId,
      firstName,
      lastName,
      dob: dob || null,
      nationality: nationality || null,
      dominantFoot,
      heightCm: heightCm ? Number(heightCm) : null,
      weightKg: weightKg ? Number(weightKg) : null,
      jerseyNumber: jerseyNumber ? Number(jerseyNumber) : null,
      positions,
      teamId,
      seasonId: defaultSeasonId,
    };

    const res = await fetch("/api/players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Error al crear el jugador");
      setLoading(false);
      return;
    }

    router.push(`/players/${data.id}`);
    router.refresh();
  }

  const inputClass =
    "w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all";

  const labelClass =
    "block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5";

  return (
    <form
      id="create-player-form"
      onSubmit={handleSubmit}
      className="glass rounded-2xl p-6 space-y-6"
    >
      {/* ── PERSONAL ── */}
      <section>
        <h2 className="text-sm font-bold text-white mb-4 pb-2 border-b border-white/5">
          Datos personales
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="player-firstname" className={labelClass}>Nombre *</label>
            <input
              id="player-firstname"
              type="text"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={inputClass}
              placeholder="Carlos"
            />
          </div>
          <div>
            <label htmlFor="player-lastname" className={labelClass}>Apellidos *</label>
            <input
              id="player-lastname"
              type="text"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className={inputClass}
              placeholder="García López"
            />
          </div>
          <div>
            <label htmlFor="player-dob" className={labelClass}>Fecha de nacimiento</label>
            <input
              id="player-dob"
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="player-nationality" className={labelClass}>Nacionalidad</label>
            <input
              id="player-nationality"
              type="text"
              value={nationality}
              onChange={(e) => setNationality(e.target.value)}
              className={inputClass}
              placeholder="Española"
            />
          </div>
        </div>
      </section>

      {/* ── FÍSICO ── */}
      <section>
        <h2 className="text-sm font-bold text-white mb-4 pb-2 border-b border-white/5">
          Datos físicos
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="player-height" className={labelClass}>Altura (cm)</label>
            <input
              id="player-height"
              type="number"
              min={140} max={220}
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              className={inputClass}
              placeholder="178"
            />
          </div>
          <div>
            <label htmlFor="player-weight" className={labelClass}>Peso (kg)</label>
            <input
              id="player-weight"
              type="number"
              min={40} max={130} step={0.1}
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              className={inputClass}
              placeholder="75"
            />
          </div>
          <div>
            <label htmlFor="player-foot" className={labelClass}>Pie dominante</label>
            <select
              id="player-foot"
              value={dominantFoot}
              onChange={(e) => setDominantFoot(e.target.value as any)}
              className={inputClass}
            >
              <option value="right">Derecho</option>
              <option value="left">Izquierdo</option>
              <option value="both">Ambidiestro</option>
            </select>
          </div>
        </div>
      </section>

      {/* ── EQUIPO ── */}
      <section>
        <h2 className="text-sm font-bold text-white mb-4 pb-2 border-b border-white/5">
          Asignación al equipo
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label htmlFor="player-team" className={labelClass}>Equipo *</label>
            <select
              id="player-team"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className={inputClass}
              required
            >
              {teams.length === 0 ? (
                <option value="">Sin equipos — crea uno primero</option>
              ) : (
                teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.category ? ` (${t.category})` : ""}
                  </option>
                ))
              )}
            </select>
          </div>
          <div>
            <label htmlFor="player-jersey" className={labelClass}>Dorsal</label>
            <input
              id="player-jersey"
              type="number"
              min={1} max={99}
              value={jerseyNumber}
              onChange={(e) => setJerseyNumber(e.target.value)}
              className={inputClass}
              placeholder="10"
            />
          </div>
        </div>

        {/* Positions */}
        <div>
          <label className={labelClass}>Posiciones en el campo</label>
          <PositionSelector selected={positions} onChange={setPositions} />
          {positions.length > 0 && (
            <p className="text-[10px] text-slate-500 mt-1.5">
              Primera posición seleccionada = posición principal
            </p>
          )}
        </div>
      </section>

      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:border-white/20 font-semibold text-sm py-2.5 transition-all"
        >
          Cancelar
        </button>
        <button
          id="create-player-submit"
          type="submit"
          disabled={loading || teams.length === 0}
          className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold text-sm py-2.5 transition-all shadow-lg shadow-emerald-950/50 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? "Guardando..." : "Añadir jugador"}
        </button>
      </div>
    </form>
  );
}
