"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PositionSelector } from "@/components/players/FieldMap";
import type { PositionKey, PlayerStatus, AvailabilityStatus } from "@/types";
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
  const [kickerRoles, setKickerRoles] = useState<string[]>(
    (player.membership?.kicker_roles as string[]) ?? []
  );

  // Physical status & availability
  const [physicalStatus, setPhysicalStatus] = useState<PlayerStatus>(
    player.physical_status ?? "green"
  );
  const [availabilityStatus, setAvailabilityStatus] = useState<AvailabilityStatus>(
    player.availability_status ?? "available"
  );
  const [availabilityNotes, setAvailabilityNotes] = useState(
    player.availability_notes ?? ""
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
        kickerRoles,
        physicalStatus,
        availabilityStatus,
        availabilityNotes: availabilityNotes.trim() || null,
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
        <h2 className="text-sm font-bold text-white mb-4 pb-2 border-b border-white/5">Estado físico y disponibilidad</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label htmlFor="edit-physical-status" className={labelClass}>Semáforo</label>
            <select
              id="edit-physical-status"
              value={physicalStatus}
              onChange={(e) => setPhysicalStatus(e.target.value as PlayerStatus)}
              className={inputClass}
            >
              <option value="green">🟢 Óptimo</option>
              <option value="yellow">🟡 Control</option>
              <option value="red">🔴 Vigilar</option>
            </select>
          </div>
          <div>
            <label htmlFor="edit-availability-status" className={labelClass}>Disponibilidad</label>
            <select
              id="edit-availability-status"
              value={availabilityStatus}
              onChange={(e) => setAvailabilityStatus(e.target.value as AvailabilityStatus)}
              className={inputClass}
            >
              <option value="available">Disponible</option>
              <option value="control">Con control</option>
              <option value="not_available">No disponible</option>
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="edit-availability-notes" className={labelClass}>Notas de disponibilidad (Fisios / Staff)</label>
          <textarea
            id="edit-availability-notes"
            value={availabilityNotes}
            onChange={(e) => setAvailabilityNotes(e.target.value)}
            placeholder="Observaciones internas sobre su estado, dolor o plazos..."
            rows={3}
            className={inputClass}
          />
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

      <section>
        <h2 className="text-sm font-bold text-white mb-4 pb-2 border-b border-white/5">Roles de Lanzamiento</h2>
        <p className="text-xs text-slate-500 mb-3">Selecciona los roles de balón parado asignados a este jugador en el equipo/temporada actual.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {([
            { key: "far_free_kick_left",   label: "Falta Lejana (Izq)" },
            { key: "far_free_kick_right",  label: "Falta Lejana (Der)" },
            { key: "close_free_kick_left", label: "Falta Cercana (Izq)" },
            { key: "close_free_kick_right",label: "Falta Cercana (Der)" },
            { key: "corner_left",          label: "Córner (Izq)" },
            { key: "corner_right",         label: "Córner (Der)" },
            { key: "penalty",              label: "Penalti" },
            { key: "throw_in_left",        label: "Saque de Banda (Izq)" },
            { key: "throw_in_right",       label: "Saque de Banda (Der)" },
            { key: "area_rival",           label: "Zona de Área Rival" },
          ] as const).map(({ key, label }) => {
            const checked = kickerRoles.includes(key);
            return (
              <label
                key={key}
                htmlFor={`kicker-${key}`}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 cursor-pointer border transition-all ${
                  checked
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-200"
                    : "bg-white/[0.03] border-white/8 text-slate-400 hover:border-white/15 hover:text-slate-200"
                }`}
              >
                <input
                  id={`kicker-${key}`}
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    setKickerRoles((prev) =>
                      prev.includes(key) ? prev.filter((r) => r !== key) : [...prev, key]
                    )
                  }
                  className="h-4 w-4 rounded accent-amber-500 cursor-pointer shrink-0"
                />
                <span className="text-sm font-medium">{label}</span>
              </label>
            );
          })}
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

