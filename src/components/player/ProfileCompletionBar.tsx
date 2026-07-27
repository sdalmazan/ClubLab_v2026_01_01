"use client";

import React, { useState } from "react";
import { Sparkles, CheckCircle2, ChevronRight, EyeOff } from "lucide-react";

interface ProfileCompletionBarProps {
  percentage: number;
  missingFields: Array<{ key: string; label: string; explanation: string }>;
  onCompleteField?: (key: string) => void;
}

export function ProfileCompletionBar({
  percentage,
  missingFields,
  onCompleteField,
}: ProfileCompletionBarProps) {
  const [guidedMode, setGuidedMode] = useState<boolean>(true);
  const [dismissedKeys, setDismissedKeys] = useState<string[]>([]);

  if (!guidedMode) return null;

  const activeMissing = missingFields.filter((f) => !dismissedKeys.includes(f.key));

  const handleDismiss = (key: string) => {
    setDismissedKeys((prev) => [...prev, key]);
  };

  return (
    <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-lg space-y-4">
      {/* Progress Bar Header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-bold text-foreground uppercase tracking-wider">
              Completitud de tu Perfil
            </span>
          </div>
          <span className="text-xs font-bold text-blue-500 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20">
            {percentage}% Completo
          </span>
        </div>

        <div className="w-full bg-accent h-2.5 rounded-full overflow-hidden p-0.5 border border-border/40">
          <div
            className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full rounded-full transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Guided Experience Suggestions */}
      {activeMissing.length > 0 && (
        <div className="space-y-3 pt-2">
          <p className="text-xs text-muted-foreground font-semibold">
            Sugerencia para personalizar tu experiencia:
          </p>

          {activeMissing.slice(0, 1).map((field) => (
            <div
              key={field.key}
              className="bg-accent/40 rounded-2xl p-4 border border-border/40 space-y-3 animate-in fade-in duration-200"
            >
              <div>
                <h4 className="text-xs font-bold text-foreground">
                  Completa tu Perfil de Jugador
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Rellena tu pie dominante, peso, altura y fecha de nacimiento para tener tu ficha al 100%.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  onClick={() => onCompleteField && onCompleteField(field.key)}
                  className="py-2.5 px-4 bg-blue-600 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md hover:bg-blue-500 transition-all cursor-pointer"
                >
                  <span>Completar Mi Perfil</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => handleDismiss(field.key)}
                  className="py-2 px-3 bg-card border border-border/50 text-muted-foreground hover:text-foreground font-semibold text-xs rounded-xl transition-all"
                >
                  Recordar luego
                </button>

                <button
                  onClick={() => setGuidedMode(false)}
                  className="py-2 px-2 text-muted-foreground/60 hover:text-muted-foreground text-xs flex items-center gap-1 transition-all ml-auto"
                  title="No mostrar más sugerencias"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Desactivar guía</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {percentage === 100 && (
        <div className="flex items-center gap-2 text-xs font-bold text-emerald-500 bg-emerald-500/10 p-3 rounded-2xl border border-emerald-500/20">
          <CheckCircle2 className="w-4 h-4" />
          <span>¡Tu perfil está al 100% completo!</span>
        </div>
      )}
    </div>
  );
}
