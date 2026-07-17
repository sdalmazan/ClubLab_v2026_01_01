"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PositionSelector } from "@/components/players/FieldMap";
import type { PositionKey, PlayerStatus, AvailabilityStatus } from "@/types";
import { NATIONALITIES } from "@/types";
import type { PlayerWithMembership } from "@/services/players";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft } from "lucide-react";

interface EditPlayerFormProps {
  player: PlayerWithMembership;
  teams: { id: string; name: string; category: string | null }[];
  userRole?: string;
}

export function EditPlayerForm({ player, teams, userRole = "player" }: EditPlayerFormProps) {
  const router = useRouter();

  const [firstName, setFirstName] = useState(player.first_name);
  const [lastName, setLastName] = useState(player.last_name);
  const [sportingName, setSportingName] = useState(player.sporting_name ?? "");
  const [dob, setDob] = useState(player.date_of_birth ?? "");
  const [nationality, setNationality] = useState(player.nationality ?? "");
  const [dominantFoot, setDominantFoot] = useState(player.dominant_foot ?? "right");
  const [heightCm, setHeightCm] = useState(player.height_cm?.toString() ?? "");
  const [weightKg, setWeightKg] = useState(player.weight_kg?.toString() ?? "");
  const [positions, setPositions] = useState<string[]>(
    (player.membership?.positions as string[]) ?? []
  );
  const [adjective, setAdjective] = useState(player.adjective ?? "");
  const [deleteMode, setDeleteMode] = useState<"inactive" | "delete" | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [teamId, setTeamId] = useState(player.membership?.team_id ?? "");
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

  const [supabase] = useState(() => createClient());
  const [dorsalConflictMsg, setDorsalConflictMsg] = useState<string | null>(null);
  const [pendingNav, setPendingNav] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasChanges =
    firstName !== player.first_name ||
    lastName !== player.last_name ||
    sportingName !== (player.sporting_name ?? "") ||
    dob !== (player.date_of_birth ?? "") ||
    nationality !== (player.nationality ?? "") ||
    dominantFoot !== (player.dominant_foot ?? "right") ||
    heightCm !== (player.height_cm?.toString() ?? "") ||
    weightKg !== (player.weight_kg?.toString() ?? "") ||
    JSON.stringify(positions) !== JSON.stringify((player.membership?.positions ?? [])) ||
    teamId !== (player.membership?.team_id ?? "") ||
    jerseyNumber !== (player.membership?.jersey_number?.toString() ?? "") ||
    JSON.stringify(kickerRoles) !== JSON.stringify((player.membership?.kicker_roles ?? [])) ||
    physicalStatus !== (player.physical_status ?? "green") ||
    availabilityStatus !== (player.availability_status ?? "available") ||
    availabilityNotes !== (player.availability_notes ?? "") ||
    adjective !== (player.adjective ?? "");

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasChanges]);

  const handleCancelClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (hasChanges) {
      setPendingNav(true);
    } else {
      router.push(`/players/${player.id}`);
    }
  };

  async function savePlayerData(): Promise<boolean> {
    setError(null);
    setLoading(true);

    if (jerseyNumber) {
      const num = Number(jerseyNumber);
      if (!isNaN(num) && num > 0) {
        // Query to check if another player in the active team has this dorsal
        const { data: existing, error: checkError } = await supabase
          .from("player_team_memberships")
          .select("player_id, players ( first_name, last_name )")
          .eq("team_id", teamId)
          .eq("jersey_number", num)
          .eq("status", "active")
          .neq("player_id", player.id);

        if (checkError) {
          console.error("Error checking jersey number:", checkError);
        } else if (existing && existing.length > 0) {
          const otherPlayer = existing[0].players as any;
          const otherName = otherPlayer ? `${otherPlayer.first_name} ${otherPlayer.last_name}` : "otro jugador";
          setDorsalConflictMsg(
            `El dorsal ${num} ya está asignado a ${otherName} en este equipo. Por favor, elige otro dorsal.`
          );
          setLoading(false);
          return false;
        }
      }
    }

    const res = await fetch(`/api/players/${player.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName,
        lastName,
        sportingName: sportingName || null,
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
        teamId,
        adjective: adjective.trim() || null,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Error al actualizar");
      setLoading(false);
      return false;
    }

    router.refresh();
    return true;
  }

  const handleDeletePlayer = async () => {
    if (!deleteMode) return;
    setDeleteLoading(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/players/${player.id}?mode=${deleteMode}&membershipId=${player.membership?.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        setDeleteError(data.error ?? "Error al procesar la baja/eliminación");
        setDeleteLoading(false);
        return;
      }

      setDeleteMode(null);
      router.push("/players");
      router.refresh();
    } catch (e: any) {
      setDeleteError(e.message || "Error de red");
      setDeleteLoading(false);
    }
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const success = await savePlayerData();
    if (success) {
      router.push(`/players/${player.id}`);
    }
  }

  const handleSaveAndExit = async () => {
    setPendingNav(false);
    const success = await savePlayerData();
    if (success) {
      router.push(`/players/${player.id}`);
    }
  };

  const inputClass =
    "w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-slate-600 corp-input-focus transition-all";

  const labelClass =
    "block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5";

  return (
    <div className="space-y-6">
      <a
        href={`/players/${player.id}`}
        onClick={handleCancelClick}
        className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors w-fit cursor-pointer"
        id="back-to-player"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a la ficha
      </a>

      <div>
        <h1 className="text-2xl font-extrabold text-white">
          Editar jugador
        </h1>
        <p className="text-slate-400 text-sm mt-0.5">
          {player.first_name} {player.last_name}
        </p>
      </div>

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
            <div className="sm:col-span-2">
              <label htmlFor="edit-sportingname" className={labelClass}>Nombre deportivo (ej: "Charly")</label>
              <input id="edit-sportingname" type="text" value={sportingName} onChange={(e) => setSportingName(e.target.value)} className={inputClass} placeholder="Charly" />
            </div>
            <div>
              <label htmlFor="edit-dob" className={labelClass}>Fecha de nacimiento</label>
              <input id="edit-dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="edit-nationality" className={labelClass}>Nacionalidad</label>
              <select
                id="edit-nationality"
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
            <div>
              <label htmlFor="edit-height" className={labelClass}>Altura (cm)</label>
              <input id="edit-height" type="number" min={100} max={250} value={heightCm} onChange={(e) => setHeightCm(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="edit-weight" className={labelClass}>Peso (kg)</label>
              <input id="edit-weight" type="number" min={40} max={130} step={0.1} value={weightKg} onChange={(e) => setWeightKg(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="edit-foot" className={labelClass}>Pie dominante</label>
              <select
                id="edit-foot"
                value={dominantFoot}
                onChange={(e) => setDominantFoot(e.target.value as any)}
                className="w-full rounded-xl bg-slate-900 border border-white/10 px-4 py-2.5 text-sm text-white corp-input-focus transition-all cursor-pointer"
              >
                <option value="right" className="bg-slate-900">Derecho</option>
                <option value="left" className="bg-slate-900">Izquierdo</option>
                <option value="both" className="bg-slate-900">Ambidiestro</option>
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
                className="w-full rounded-xl bg-slate-900 border border-white/10 px-4 py-2.5 text-sm text-white corp-input-focus transition-all cursor-pointer"
              >
                <option value="green" className="bg-slate-900">🟢 Óptimo</option>
                <option value="yellow" className="bg-slate-900">🟡 Control</option>
                <option value="red" className="bg-slate-900">🔴 Vigilar</option>
              </select>
            </div>
            <div>
              <label htmlFor="edit-availability-status" className={labelClass}>Disponibilidad</label>
              <select
                id="edit-availability-status"
                value={availabilityStatus}
                onChange={(e) => setAvailabilityStatus(e.target.value as AvailabilityStatus)}
                className="w-full rounded-xl bg-slate-900 border border-white/10 px-4 py-2.5 text-sm text-white corp-input-focus transition-all cursor-pointer"
              >
                <option value="available" className="bg-slate-900">Disponible</option>
                <option value="control" className="bg-slate-900">Con control</option>
                <option value="not_available" className="bg-slate-900">No disponible</option>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor="edit-team" className={labelClass}>Equipo *</label>
              <select
                id="edit-team"
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="w-full rounded-xl bg-slate-900 border border-white/10 px-4 py-2.5 text-sm text-white corp-input-focus transition-all cursor-pointer"
                required
              >
                <option value="" className="bg-slate-900">Selecciona un equipo</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id} className="bg-slate-900">
                    {t.name} ({t.category || "General"})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="edit-jersey" className={labelClass}>Dorsal</label>
              <input
                id="edit-jersey"
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
            ] as const).map(({ key, label }) => {
              const checked = kickerRoles.includes(key);
              return (
                <label
                  key={key}
                  className={`flex items-center gap-3 rounded-xl p-3 border transition-all cursor-pointer ${
                    checked
                      ? "corp-badge border-[var(--corp-border-strong)]"
                      : "border-white/5 bg-white/2 hover:border-white/10 text-slate-400 hover:text-white"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setKickerRoles([...kickerRoles, key]);
                      } else {
                        setKickerRoles(kickerRoles.filter((r) => r !== key));
                      }
                    }}
                    className="rounded border-white/10 bg-white/5 corp-accent h-4 w-4"
                  />
                  <span className="text-sm font-medium">{label}</span>
                </label>
              );
            })}
          </div>
        </section>

        {userRole !== "player" && (
          <section>
            <h2 className="text-sm font-bold text-white mb-4 pb-2 border-b border-white/5">
              Información de Cuerpo Técnico
            </h2>
            <div>
              <label htmlFor="edit-adjective" className={labelClass}>Adjetivo descriptivo (Cuerpo Técnico)</label>
              <input
                id="edit-adjective"
                type="text"
                value={adjective}
                onChange={(e) => setAdjective(e.target.value)}
                className={inputClass}
                placeholder="Ej. Técnico, Rápido, Rematador..."
              />
              <p className="text-[10px] text-slate-500 mt-1.5 leading-normal">
                Este adjetivo solo es visible y editable por el cuerpo técnico. Los jugadores no lo verán en su ficha.
              </p>
            </div>
          </section>
        )}

        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">{error}</div>
        )}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={handleCancelClick} className="flex-1 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:border-white/20 font-semibold text-sm py-2.5 transition-all">
            Cancelar
          </button>
          <button id="edit-player-submit" type="submit" disabled={loading} className="flex-1 rounded-xl btn-corporate font-semibold text-sm py-2.5 transition-all shadow-lg disabled:opacity-60 disabled:cursor-not-allowed">
            {loading ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>

      {userRole !== "player" && (
        <div className="glass rounded-2xl p-6 border border-red-500/10 space-y-4">
          <h2 className="text-sm font-bold text-rose-455">Zona de Peligro</h2>
          <p className="text-xs text-slate-400 leading-normal">
            Elimina al jugador de la temporada actual o regístralo como baja manteniendo su histórico.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setDeleteMode("inactive")}
              disabled={deleteLoading}
              className="px-4 py-2.5 rounded-xl border border-white/10 hover:border-white/20 text-slate-300 hover:text-white text-xs font-semibold bg-white/5 transition-all cursor-pointer disabled:opacity-50"
            >
              Dar de baja (Mantener histórico)
            </button>
            <button
              type="button"
              onClick={() => setDeleteMode("delete")}
              disabled={deleteLoading}
              className="px-4 py-2.5 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
            >
              Eliminar del todo
            </button>
          </div>
          {deleteError && (
            <p className="text-xs text-rose-400 font-medium">{deleteError}</p>
          )}
        </div>
      )}

      <AlertModal
        isOpen={dorsalConflictMsg !== null}
        title="Dorsal Duplicado"
        message={dorsalConflictMsg || ""}
        onConfirm={() => setDorsalConflictMsg(null)}
      />

      <AlertModal
        isOpen={deleteMode !== null}
        title={deleteMode === "inactive" ? "Dar de baja jugador" : "Eliminar jugador del todo"}
        message={
          deleteMode === "inactive"
            ? "¿Estás seguro de que deseas dar de baja a este jugador del equipo para la temporada actual? Se mantendrá en el histórico en tono gris y no se utilizará para planificar sesiones, partidos o lesiones."
            : "¿Estás seguro de que deseas eliminar permanentemente a este jugador de la plantilla para esta temporada? Esta acción eliminará su vinculación con el equipo y no se puede deshacer."
        }
        confirmLabel={deleteMode === "inactive" ? "Confirmar baja" : "Eliminar del todo"}
        cancelLabel="Cancelar"
        onConfirm={handleDeletePlayer}
        onCancel={() => setDeleteMode(null)}
      />

      <AlertModal
        isOpen={pendingNav}
        title="Cambios sin guardar"
        message="¿Qué deseas hacer con los cambios realizados?"
        confirmLabel="Salir sin guardar"
        cancelLabel="Cancelar"
        saveLabel="Guardar y salir"
        onConfirm={() => {
          setPendingNav(false);
          router.push(`/players/${player.id}`);
        }}
        onCancel={() => setPendingNav(false)}
        onSave={handleSaveAndExit}
      />
    </div>
  );
}

interface AlertModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  saveLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  onSave?: () => void;
}

function AlertModal({
  isOpen,
  title,
  message,
  confirmLabel = "Aceptar",
  cancelLabel,
  saveLabel,
  onConfirm,
  onCancel,
  onSave,
}: AlertModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="glass max-w-md w-full rounded-2xl border border-white/10 p-6 space-y-4 shadow-2xl animate-in fade-in duration-200">
        <h3 className="text-base font-bold text-white uppercase tracking-wider">{title}</h3>
        <p className="text-slate-350 text-xs leading-relaxed font-medium">{message}</p>
        <div className="flex gap-2.5 justify-end pt-2 flex-wrap sm:flex-nowrap">
          {cancelLabel && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-3.5 py-2 rounded-xl border border-white/10 hover:border-white/20 text-slate-400 hover:text-white text-xs font-semibold transition-all cursor-pointer flex-1 sm:flex-initial"
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            className="px-3.5 py-2 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-450 hover:bg-rose-500/20 text-xs font-semibold transition-all cursor-pointer flex-1 sm:flex-initial"
          >
            {confirmLabel}
          </button>
          {saveLabel && onSave && (
            <button
              type="button"
              onClick={onSave}
              className="px-4 py-2 rounded-xl btn-corporate text-xs font-semibold shadow-lg cursor-pointer flex-1 sm:flex-initial"
            >
              {saveLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
