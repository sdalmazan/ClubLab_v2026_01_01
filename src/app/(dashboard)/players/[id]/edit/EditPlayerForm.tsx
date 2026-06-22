"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PositionSelector } from "@/components/players/FieldMap";
import type { PositionKey } from "@/types";
import type { PlayerWithMembership } from "@/services/players";

interface EditPlayerFormProps {
  player: PlayerWithMembership;
  teams: { id: string; name: string; category: string | null }[];
}

export function EditPlayerForm({ player, teams }: EditPlayerFormProps) {
  const router = useRouter();

  const [firstName, setFirstName] = useState(player.first_name);
  const [lastName, setLastName] = useState(player.last_name);
  const [dob, setDob] = useState(player.date_of_birth ?? "");
  const [nationality, setNationality] = useState(player.nationality ?? "");
  const [dominantFoot, setDominantFoot] = useState(player.dominant_foot ?? "right");
  const [heightCm, setHeightCm] = useState(player.height_cm?.toString() ?? "");
  const [weightKg, setWeightKg] = useState(player.weight_kg?.toString() ?? "");
  const [positions, setPositions] = useState<PositionKey[]>(
    (player.membership?.positions as PositionKey[]) ?? []
  );
  const [jerseyNumber, setJerseyNumber] = useState(
    player.membership?.jersey_number?.toString() ?? ""
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch(`/api/players/${player.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName,
        lastName,
        dob: dob || null,
        nationality: nationality || null,
        dominantFoot,
        heightCm: heightCm ? Number(heightCm) : null,
        weightKg: weightKg ? Number(weightKg) : null,
        positions,
        jerseyNumber: jerseyNumber ? Number(jerseyNumber) : null,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Error al actualizar");
      setLoading(false);
      return;
    }

    router.push(`/players/${player.id}`);
    router.refresh();
  }

  const inputClass =
    "w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all";

  const labelClass =
    "block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5";

  return (
    <form id="edit-player-form" onSubmit={handleSubmit} className="glass rounded-2xl p-6 space-y-6">
      <section>
        <h2 className="text-sm font-bold text-white mb-4 pb-2 border-b border-white/5">Datos personales</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="edit-firstname" className={labelClass}>Nombre *</label>
            <input id="edit-firstname" type="text" required value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="edit-lastname" className={labelClass}>Apellidos *</label>
            <input id="edit-lastname" type="text" required value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="edit-dob" className={labelClass}>Fecha de nacimiento</label>
            <input id="edit-dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="edit-nationality" className={labelClass}>Nacionalidad</label>
            <input id="edit-nationality" type="text" value={nationality} onChange={(e) => setNationality(e.target.value)} className={inputClass} placeholder="Española" />
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-bold text-white mb-4 pb-2 border-b border-white/5">Datos físicos</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="edit-height" className={labelClass}>Altura (cm)</label>
            <input id="edit-height" type="number" min={140} max={220} value={heightCm} onChange={(e) => setHeightCm(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="edit-weight" className={labelClass}>Peso (kg)</label>
            <input id="edit-weight" type="number" min={40} max={130} step={0.1} value={weightKg} onChange={(e) => setWeightKg(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="edit-foot" className={labelClass}>Pie dominante</label>
            <select id="edit-foot" value={dominantFoot} onChange={(e) => setDominantFoot(e.target.value as any)} className={inputClass}>
              <option value="right">Derecho</option>
              <option value="left">Izquierdo</option>
              <option value="both">Ambidiestro</option>
            </select>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-bold text-white mb-4 pb-2 border-b border-white/5">Posiciones y dorsal</h2>
        <div className="mb-4">
          <label htmlFor="edit-jersey" className={labelClass}>Dorsal</label>
          <input id="edit-jersey" type="number" min={1} max={99} value={jerseyNumber} onChange={(e) => setJerseyNumber(e.target.value)} className={`${inputClass} max-w-[120px]`} />
        </div>
        <div>
          <label className={labelClass}>Posiciones</label>
          <PositionSelector selected={positions} onChange={setPositions} />
        </div>
      </section>

      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={() => router.back()} className="flex-1 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:border-white/20 font-semibold text-sm py-2.5 transition-all">
          Cancelar
        </button>
        <button id="edit-player-submit" type="submit" disabled={loading} className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold text-sm py-2.5 transition-all shadow-lg shadow-emerald-950/50 disabled:opacity-60 disabled:cursor-not-allowed">
          {loading ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
