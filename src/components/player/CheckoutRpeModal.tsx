"use client";

import React, { useState } from "react";
import { X, Check, Dumbbell, Flame } from "lucide-react";

interface CheckoutRpeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitSuccess: () => void;
  sessionTitle?: string;
  sessionId?: string;
  matchId?: string;
}

export function CheckoutRpeModal({
  isOpen,
  onClose,
  onSubmitSuccess,
  sessionTitle = "Entrenamiento de Plantilla (19:30h)",
  sessionId,
  matchId,
}: CheckoutRpeModalProps) {
  const [rpe, setRpe] = useState<number>(7);
  const [postFeeling, setPostFeeling] = useState<"very_good" | "good" | "loaded" | "very_loaded">("good");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await fetch("/api/player/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rpe,
          postFeeling,
          sessionId,
          matchId,
        }),
      });
    } catch (err) {
      console.error("Error submitting check-out RPE:", err);
    } finally {
      setIsSubmitting(false);
      onSubmitSuccess();
    }
  };

  const getRpeLabel = (val: number) => {
    if (val <= 2) return "Muy suave";
    if (val <= 4) return "Moderado";
    if (val <= 6) return "Algo duro";
    if (val <= 8) return "Duro";
    return "Máximo / Extremo";
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-card w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-border shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="p-4 border-b border-border/50 flex items-center justify-between bg-blue-500/5">
          <div>
            <span className="text-[11px] font-bold text-blue-500 uppercase tracking-wider block">
              Check-out Post-Entrenamiento • {sessionTitle}
            </span>
            <h2 className="text-lg font-bold text-foreground">¿Cómo ha sido el esfuerzo?</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-4 overflow-y-auto space-y-5 flex-1 pb-6">
            {/* RPE Selector */}
            <div className="bg-accent/30 rounded-2xl p-4 border border-border/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-blue-500" />
                  <span className="text-xs font-semibold text-foreground">Percepción del Esfuerzo (RPE)</span>
                </div>
                <span className="text-sm font-bold text-blue-500 bg-blue-500/10 px-3 py-0.5 rounded-full border border-blue-500/20">
                  {rpe} - {getRpeLabel(rpe)}
                </span>
              </div>

              <div className="grid grid-cols-5 gap-2 pt-1">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setRpe(val)}
                    className={`h-11 rounded-xl font-bold text-sm transition-all active:scale-95 flex items-center justify-center ${
                      rpe === val
                        ? "bg-blue-600 text-white shadow-md scale-105"
                        : "bg-card hover:bg-card/80 text-foreground border border-border/50"
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>

            {/* Post Feeling */}
            <div className="bg-accent/30 rounded-2xl p-4 border border-border/40 space-y-2">
              <label className="text-xs font-semibold text-foreground flex items-center gap-2">
                <Dumbbell className="w-4 h-4 text-blue-500" />
                Sensación general post-sesión
              </label>

              <div className="grid grid-cols-2 gap-2 pt-1">
                {[
                  { key: "very_good", label: "Muy buena" },
                  { key: "good", label: "Buena" },
                  { key: "loaded", label: "Cargado" },
                  { key: "very_loaded", label: "Muy cargado" },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setPostFeeling(item.key as any)}
                    className={`py-3 px-3 rounded-xl font-semibold text-xs transition-all border ${
                      postFeeling === item.key
                        ? "bg-blue-600 text-white border-blue-600 font-bold"
                        : "bg-card border-border/50 text-foreground hover:bg-card/80"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Sticky Footer Button ("Enviar") */}
          <div
            className="p-4 border-t border-border/50 bg-card shrink-0 shadow-lg"
            style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
          >
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <span>Enviando...</span>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  <span>Enviar</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
