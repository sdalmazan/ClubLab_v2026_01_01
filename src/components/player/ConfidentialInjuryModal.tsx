"use client";

import React, { useState } from "react";
import { X, Check, ShieldCheck, Lock, HeartPulse, HelpCircle } from "lucide-react";
import { ConfidentialInjuryInput } from "@/services/playerExperienceService";

import { createClient } from "@/lib/supabase/client";

interface ConfidentialInjuryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitSuccess: (injury: ConfidentialInjuryInput) => void;
}

export function ConfidentialInjuryModal({
  isOpen,
  onClose,
  onSubmitSuccess,
}: ConfidentialInjuryModalProps) {
  const [injuryType, setInjuryType] = useState("Sobrecarga muscular");
  const [bodyPart, setBodyPart] = useState("Isquiotibiales");
  const [occurredDate, setOccurredDate] = useState(new Date().toISOString().split("T")[0]);
  const [isConfidential, setIsConfidential] = useState(true);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: player } = await supabase
          .from("players")
          .select("id, organization_id, team_id")
          .or(`user_id.eq.${user.id},email.eq.${user.email}`)
          .maybeSingle();

        if (player) {
          await supabase.from("injuries").insert({
            organization_id: player.organization_id,
            team_id: player.team_id,
            player_id: player.id,
            injury_type: injuryType,
            body_part: bodyPart,
            occurred_date: occurredDate,
            notes: notes || null,
            severity: "medium",
            status: "active",
            is_confidential: isConfidential,
          });
        }
      }

      onSubmitSuccess({
        injuryType,
        bodyPart,
        occurredDate,
        isConfidential,
        notes,
      });
      onClose();
    } catch (err: any) {
      console.error("Error saving injury:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-card w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-border shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="p-4 border-b border-border/50 flex items-center justify-between bg-blue-500/5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <HeartPulse className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-blue-500 uppercase tracking-wider">
                Historial de Lesiones
              </span>
              <h2 className="text-base font-bold text-foreground">Añadir Lesión o Molestia</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">
              Tipo de Lesión o Molestia
            </label>
            <input
              type="text"
              value={injuryType}
              onChange={(e) => setInjuryType(e.target.value)}
              placeholder="Ej. Sobrecarga, Tirón, Molestia articular..."
              className="w-full p-3.5 rounded-2xl bg-accent/30 border border-border/50 text-xs font-semibold text-foreground focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Zona Corporal
              </label>
              <select
                value={bodyPart}
                onChange={(e) => setBodyPart(e.target.value)}
                className="w-full p-3.5 rounded-2xl bg-accent/30 border border-border/50 text-xs font-semibold text-foreground focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="Isquiotibiales">Isquiotibiales</option>
                <option value="Cuádriceps">Cuádriceps</option>
                <option value="Gemelos">Gemelos</option>
                <option value="Aductores">Aductores</option>
                <option value="Rodilla">Rodilla</option>
                <option value="Tobillo">Tobillo</option>
                <option value="Espalda">Espalda</option>
                <option value="Hombros">Hombros</option>
                <option value="Otro">Otro</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Fecha Aprox.
              </label>
              <input
                type="date"
                value={occurredDate}
                onChange={(e) => setOccurredDate(e.target.value)}
                className="w-full p-3.5 rounded-2xl bg-accent/30 border border-border/50 text-xs font-semibold text-foreground focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Confidentiality Toggle Section */}
          <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-bold text-foreground">Marcar como Confidencial</span>
              </div>
              <button
                type="button"
                onClick={() => setIsConfidential(!isConfidential)}
                className={`w-11 h-6 rounded-full p-1 transition-colors ${
                  isConfidential ? "bg-blue-600" : "bg-muted"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    isConfidential ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              🔒 <strong>¿Qué significa?</strong> Al estar activado, este registro de lesión <strong>sólo será visible para los Servicios Médicos y Fisioterapia del club</strong>. No será visible para entrenadores ni directiva.
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">
              Notas Adicionales (opcional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Sensaciones o tratamiento realizado..."
              className="w-full p-3 rounded-2xl bg-accent/30 border border-border/50 text-xs text-foreground focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {isSubmitting ? (
              <span>Guardando...</span>
            ) : (
              <>
                <Check className="w-5 h-5" />
                <span>Guardar Lesión</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
