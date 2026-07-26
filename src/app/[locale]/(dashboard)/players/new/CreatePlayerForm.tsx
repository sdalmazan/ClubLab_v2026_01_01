"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PositionSelector } from "@/components/players/FieldMap";
import type { PositionKey } from "@/types";
import { NATIONALITIES } from "@/types";
import { createClient } from "@/lib/supabase/client";

interface Team {
  id: string;
  name: string;
  category: string | null;
}

interface CreatePlayerFormProps {
  teams: Team[];
  defaultSeasonId: string;
  organizationId: string;
  userRole?: string;
}

export function CreatePlayerForm({
  teams,
  defaultSeasonId,
  organizationId,
  userRole = "player",
}: CreatePlayerFormProps) {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [sportingName, setSportingName] = useState("");
  const [dob, setDob] = useState("");
  const [nationality, setNationality] = useState("Española");
  const [dominantFoot, setDominantFoot] = useState<"right" | "left" | "both">("right");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [jerseyNumber, setJerseyNumber] = useState("");
  const [positions, setPositions] = useState<string[]>([]);
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dorsalConflictMsg, setDorsalConflictMsg] = useState<string | null>(null);
  const [adjective, setAdjective] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!teamId) {
      setError("Selecciona un equipo");
      return;
    }
    setError(null);
    setLoading(true);

    if (jerseyNumber) {
      const num = Number(jerseyNumber);
      if (!isNaN(num) && num > 0) {
        const supabase = createClient();
        const { data: existing, error: checkError } = await supabase
          .from("player_team_memberships")
          .select("player_id, players ( first_name, last_name )")
          .eq("team_id", teamId)
          .eq("jersey_number", num)
          .eq("status", "active");

        if (checkError) {
          console.error("Error checking jersey number:", checkError);
        } else if (existing && existing.length > 0) {
          const otherPlayer = existing[0].players as any;
          const otherName = otherPlayer ? `${otherPlayer.first_name} ${otherPlayer.last_name}` : "otro jugador";
          setDorsalConflictMsg(
            `El dorsal ${num} ya está asignado a ${otherName} en este equipo. Por favor, elige otro dorsal.`
          );
          setLoading(false);
          return;
        }
      }
    }

    const body = {
      organizationId,
      firstName,
      lastName,
      sportingName: sportingName || null,
      dob: dob || null,
      nationality: nationality || null,
      dominantFoot,
      heightCm: heightCm ? Number(heightCm) : null,
      weightKg: weightKg ? Number(weightKg) : null,
      jerseyNumber: jerseyNumber ? Number(jerseyNumber) : null,
      positions,
      teamId,
      seasonId: defaultSeasonId,
      adjective: adjective.trim() || null,
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
    "w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-slate-600 corp-input-focus transition-all";

  const labelClass =
    "block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5";

  return (
    <>
      <form
        id="create-player-form"
        onSubmit={handleSubmit}
        className="bg-card rounded-lg border border-border p-6 space-y-6"
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
          <div className="sm:col-span-2">
            <label htmlFor="player-sportingname" className={labelClass}>Nombre deportivo (ej: "Charly")</label>
            <input
              id="player-sportingname"
              type="text"
              value={sportingName}
              onChange={(e) => setSportingName(e.target.value)}
              className={inputClass}
              placeholder="Charly"
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
            <select
              id="player-nationality"
              value={nationality}
              onChange={(e) => setNationality(e.target.value)}
              className={inputClass}
            >
              <option value="">Selecciona nacionalidad...</option>
              {NATIONALITIES.map((n) => (
                <option key={n.value} value={n.value}>
                  {n.label}
                </option>
              ))}
            </select>
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
              type="text"
              pattern="[0-9]*"
              inputMode="numeric"
              value={jerseyNumber}
              onChange={(e) => setJerseyNumber(e.target.value.replace(/\D/g, ""))}
              className={inputClass}
              placeholder="Ej. 10"
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

        {userRole !== "player" && (
          <div className="mt-4 border-t border-white/5 pt-4">
            <label htmlFor="player-adjective" className={labelClass}>Adjetivo descriptivo (Cuerpo Técnico)</label>
            <input
              id="player-adjective"
              type="text"
              value={adjective}
              onChange={(e) => setAdjective(e.target.value)}
              className={inputClass}
              placeholder="Ej. Técnico, Rápido, Rematador..."
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Este adjetivo solo es visible y editable por el cuerpo técnico. Los jugadores no lo verán en su ficha.
            </p>
          </div>
        )}
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
          className="flex-1 rounded-xl btn-corporate font-semibold text-sm py-2.5 transition-all shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? "Guardando..." : "Añadir jugador"}
        </button>
      </div>
    </form>
      
      <AlertModal
        isOpen={dorsalConflictMsg !== null}
        title="Dorsal Duplicado"
        message={dorsalConflictMsg || ""}
        onConfirm={() => setDorsalConflictMsg(null)}
      />
    </>
  );
}

interface AlertModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

function AlertModal({
  isOpen,
  title,
  message,
  confirmLabel = "Aceptar",
  cancelLabel,
  onConfirm,
  onCancel,
}: AlertModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-popover border border-border shadow-md max-w-md w-full rounded-lg p-6 space-y-4 animate-in fade-in duration-200">
        <h3 className="text-base font-bold text-white uppercase tracking-wider">{title}</h3>
        <p className="text-slate-350 text-xs leading-relaxed font-medium">{message}</p>
        <div className="flex gap-3 justify-end pt-2">
          {cancelLabel && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-xl border border-white/10 hover:border-white/20 text-slate-400 hover:text-white text-xs font-semibold transition-all cursor-pointer"
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl btn-corporate text-xs font-semibold shadow-lg cursor-pointer"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
