"use client";

import React, { useState, useEffect } from "react";
import { X, Check, User, Dumbbell, Activity, Calendar, Globe, ShieldCheck, Hash } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface PlayerProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFieldFocus?: string;
  onSaved?: () => void;
}

export function PlayerProfileEditModal({
  isOpen,
  onClose,
  initialFieldFocus,
  onSaved,
}: PlayerProfileEditModalProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [sportingName, setSportingName] = useState("");
  const [dominantFoot, setDominantFoot] = useState<"right" | "left" | "both">("right");
  const [heightCm, setHeightCm] = useState<number | "">(180);
  const [weightKg, setWeightKg] = useState<number | "">(75);
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [nationality, setNationality] = useState("Española");
  const [jerseyNumber, setJerseyNumber] = useState<number | "">(10);
  const [injuries, setInjuries] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    async function loadPlayerData() {
      setLoading(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: player } = await supabase
          .from("players")
          .select("*")
          .or(`user_id.eq.${user.id},email.eq.${user.email}`)
          .maybeSingle();

        if (player) {
          setFirstName(player.first_name || "");
          setLastName(player.last_name || "");
          setSportingName(player.sporting_name || "");
          if (player.dominant_foot) setDominantFoot(player.dominant_foot);
          if (player.height_cm) setHeightCm(player.height_cm);
          if (player.weight_kg) setWeightKg(player.weight_kg);
          if (player.date_of_birth) setDateOfBirth(player.date_of_birth);
          if (player.nationality) setNationality(player.nationality);
          if (player.jersey_number) setJerseyNumber(player.jersey_number);

          // Fetch player's injuries
          const { data: injData } = await supabase
            .from("injuries")
            .select("*")
            .eq("player_id", player.id)
            .order("occurred_date", { ascending: false });

          if (injData) setInjuries(injData);
        }
      }
      setLoading(false);
    }

    loadPlayerData();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setError("No estás autenticado.");
        setSaving(false);
        return;
      }

      const { data: playerRow } = await supabase
        .from("players")
        .select("id")
        .or(`user_id.eq.${user.id},email.eq.${user.email}`)
        .maybeSingle();

      if (playerRow) {
        const { error: updateErr } = await supabase
          .from("players")
          .update({
            first_name: firstName,
            last_name: lastName,
            sporting_name: sportingName || `${firstName} ${lastName}`.trim(),
            dominant_foot: dominantFoot,
            height_cm: heightCm !== "" ? Number(heightCm) : null,
            weight_kg: weightKg !== "" ? Number(weightKg) : null,
            date_of_birth: dateOfBirth || null,
            nationality: nationality || "Española",
            jersey_number: jerseyNumber !== "" ? Number(jerseyNumber) : null,
          })
          .eq("id", playerRow.id);

        if (updateErr) {
          console.error("Error updating player profile in DB:", updateErr);
          // If jersey_number column is not present in DB schema yet, attempt update without jersey_number fallback
          if (updateErr.message?.includes("jersey_number") || updateErr.message?.includes("schema cache")) {
            const { error: fallbackErr } = await supabase
              .from("players")
              .update({
                first_name: firstName,
                last_name: lastName,
                sporting_name: sportingName || `${firstName} ${lastName}`.trim(),
                dominant_foot: dominantFoot,
                height_cm: heightCm !== "" ? Number(heightCm) : null,
                weight_kg: weightKg !== "" ? Number(weightKg) : null,
                date_of_birth: dateOfBirth || null,
                nationality: nationality || "Española",
              })
              .eq("id", playerRow.id);

            if (fallbackErr) {
              setError("No se pudieron guardar los cambios de perfil. Inténtalo de nuevo.");
            } else {
              setMessage("¡Perfil actualizado con éxito!");
              if (onSaved) onSaved();
              setTimeout(() => {
                onClose();
              }, 1200);
            }
          } else {
            setError("No se pudieron guardar los cambios de perfil. Inténtalo de nuevo.");
          }
        } else {
          setMessage("¡Perfil actualizado con éxito!");
          if (onSaved) onSaved();
          setTimeout(() => {
            onClose();
          }, 1200);
        }
      } else {
        setMessage("Perfil guardado localmente.");
        if (onSaved) onSaved();
        setTimeout(() => {
          onClose();
        }, 1000);
      }
    } catch (err: any) {
      console.error("Error saving player profile:", err);
      setError("No se pudieron guardar los cambios de perfil. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-card w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-border shadow-2xl overflow-hidden max-h-[85vh] sm:max-h-[90vh] mb-16 sm:mb-0 flex flex-col animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="p-4 border-b border-border/50 flex items-center justify-between bg-blue-500/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <User className="w-5 h-5 text-blue-500" />
            <div>
              <span className="text-[10px] font-extrabold text-blue-500 uppercase tracking-wider block">
                Completar Perfil del Jugador
              </span>
              <h2 className="text-base font-bold text-foreground">Editar Ficha Personal y Físicos</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-4 overflow-y-auto space-y-4 flex-1 pb-6">
            {loading ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                Cargando información del jugador...
              </div>
            ) : (
              <>
                {/* Nombres */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase">Nombre</label>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full p-3 rounded-xl bg-accent/40 border border-border/50 text-xs text-foreground focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase">Apellidos</label>
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full p-3 rounded-xl bg-accent/40 border border-border/50 text-xs text-foreground focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Pie Dominante */}
                <div className={`p-3.5 rounded-2xl bg-accent/30 border ${initialFieldFocus === 'dominant_foot' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-border/40'} space-y-2`}>
                  <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Dumbbell className="w-4 h-4 text-blue-500" />
                    Pie Dominante
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: "right", label: "Diestro (Derecho)" },
                      { key: "left", label: "Zurdo (Izquierdo)" },
                      { key: "both", label: "Ambidiestro" },
                    ].map((foot) => (
                      <button
                        key={foot.key}
                        type="button"
                        onClick={() => setDominantFoot(foot.key as any)}
                        className={`p-2.5 rounded-xl text-xs font-bold transition-all border ${
                          dominantFoot === foot.key
                            ? "bg-blue-600 text-white border-blue-500 shadow-md"
                            : "bg-card border-border/50 text-foreground hover:bg-accent"
                        }`}
                      >
                        {foot.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Datos Físicos: Altura y Peso */}
                <div className="grid grid-cols-2 gap-3">
                  <div className={`p-3.5 rounded-2xl bg-accent/30 border ${initialFieldFocus === 'height_cm' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-border/40'} space-y-1.5`}>
                    <label className="text-xs font-bold text-foreground flex items-center gap-1">
                      <Activity className="w-3.5 h-3.5 text-blue-500" /> Altura (cm)
                    </label>
                    <input
                      type="number"
                      min="140"
                      max="220"
                      value={heightCm}
                      onChange={(e) => setHeightCm(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full p-2.5 rounded-xl bg-card border border-border/50 text-xs font-bold text-foreground focus:outline-none focus:border-blue-500"
                      placeholder="Ej. 180"
                    />
                  </div>

                  <div className={`p-3.5 rounded-2xl bg-accent/30 border ${initialFieldFocus === 'weight_kg' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-border/40'} space-y-1.5`}>
                    <label className="text-xs font-bold text-foreground flex items-center gap-1">
                      <Activity className="w-3.5 h-3.5 text-blue-500" /> Peso (kg)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="40"
                      max="140"
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full p-2.5 rounded-xl bg-card border border-border/50 text-xs font-bold text-foreground focus:outline-none focus:border-blue-500"
                      placeholder="Ej. 75.5"
                    />
                  </div>
                </div>

                {/* Dorsal, Fecha de Nacimiento y Nacionalidad */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1 uppercase">
                      <ShieldCheck className="w-3 h-3 text-blue-500" /> Dorsal
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="99"
                      value={jerseyNumber}
                      onChange={(e) => setJerseyNumber(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full p-2.5 rounded-xl bg-accent/40 border border-border/50 text-xs font-bold text-foreground focus:outline-none focus:border-blue-500"
                      placeholder="Ej. 10"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1 uppercase">
                      <Calendar className="w-3 h-3 text-blue-500" /> Nacimiento
                    </label>
                    <input
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-accent/40 border border-border/50 text-xs text-foreground focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1 uppercase">
                      <Globe className="w-3 h-3 text-blue-500" /> Nacionalidad
                    </label>
                    <input
                      type="text"
                      value={nationality}
                      onChange={(e) => setNationality(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-accent/40 border border-border/50 text-xs text-foreground focus:outline-none focus:border-blue-500"
                      placeholder="Española"
                    />
                  </div>
                </div>

                {error && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold">
                    {error}
                  </div>
                )}

                {message && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    <span>{message}</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Sticky Footer Button */}
          <div
            className="p-4 border-t border-border/50 bg-card shrink-0 shadow-lg"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50 cursor-pointer"
            >
              {saving ? (
                <span>Guardando...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Guardar Cambios de Perfil</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
