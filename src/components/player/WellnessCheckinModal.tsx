"use client";

import React, { useState } from "react";
import { X, Check, HeartPulse, Moon, Smile, Activity, AlertCircle, MessageSquarePlus } from "lucide-react";

interface WellnessCheckinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitSuccess: () => void;
}

export function WellnessCheckinModal({
  isOpen,
  onClose,
  onSubmitSuccess,
}: WellnessCheckinModalProps) {
  const [sleepQuality, setSleepQuality] = useState<number>(4);
  const [fatigue, setFatigue] = useState<number>(2);
  const [mood, setMood] = useState<number>(4);
  const [muscleSoreness, setMuscleSoreness] = useState<number>(1);
  const [stress, setStress] = useState<number>(2);

  // Discomfort State
  const [hasDiscomfort, setHasDiscomfort] = useState<boolean>(false);
  const [discomfortPart, setDiscomfortPart] = useState<string>("Isquiotibiales");
  const [customDiscomfortPart, setCustomDiscomfortPart] = useState<string>("");
  const [discomfortIntensity, setDiscomfortIntensity] = useState<number>(3);

  // Optional Comments State (disabled/collapsed by default)
  const [showComments, setShowComments] = useState<boolean>(false);
  const [comments, setComments] = useState<string>("");

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      onSubmitSuccess();
    }, 600);
  };

  const renderRatingGroup = (
    label: string,
    icon: React.ElementType,
    value: number,
    onChange: (val: number) => void,
    minLabel = "Bajo",
    maxLabel = "Excelente"
  ) => {
    const Icon = icon;
    return (
      <div className="bg-accent/30 rounded-2xl p-3.5 border border-border/40">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-semibold text-foreground">{label}</span>
          </div>
          <span className="text-xs font-bold text-blue-500 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20">
            {value} / 5
          </span>
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {[1, 2, 3, 4, 5].map((rating) => (
            <button
              key={rating}
              type="button"
              onClick={() => onChange(rating)}
              className={`h-11 rounded-xl font-bold text-sm transition-all active:scale-95 flex items-center justify-center ${
                value === rating
                  ? "bg-blue-600 text-white shadow-md scale-[1.02]"
                  : "bg-card hover:bg-card/80 text-foreground border border-border/50"
              }`}
            >
              {rating}
            </button>
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5 px-0.5">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      </div>
    );
  };

  const bodyParts = [
    "Isquiotibiales",
    "Cuádriceps",
    "Gemelos",
    "Aductores",
    "Rodilla",
    "Tobillo",
    "Espalda",
    "Glúteo",
    "Hombros",
    "Otro",
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-card w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-border shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="p-4 border-b border-border/50 flex items-center justify-between bg-blue-500/5">
          <div>
            <span className="text-[11px] font-bold text-blue-500 uppercase tracking-wider">
              Check-in Pre-Entrenamiento
            </span>
            <h2 className="text-lg font-bold text-foreground">¿Cómo te sientes hoy?</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto space-y-4 flex-1">
          {renderRatingGroup("Calidad del Sueño", Moon, sleepQuality, setSleepQuality, "Pobre", "Excelente")}
          {renderRatingGroup("Nivel de Fatiga", HeartPulse, fatigue, setFatigue, "Sin fatiga", "Muy fatigado")}
          {renderRatingGroup("Estado de Ánimo", Smile, mood, setMood, "Bajo", "Excelente")}
          {renderRatingGroup("Molestia Muscular", Activity, muscleSoreness, setMuscleSoreness, "Ninguna", "Alta")}

          {/* Conditional Discomfort Toggle */}
          <div className="bg-accent/30 rounded-2xl p-4 border border-border/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-semibold text-foreground">
                  ¿Tienes alguna molestia focalizada?
                </span>
              </div>
              <div className="flex items-center gap-1 bg-card p-1 rounded-xl border border-border/40">
                <button
                  type="button"
                  onClick={() => setHasDiscomfort(false)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    !hasDiscomfort
                      ? "bg-blue-600 text-white"
                      : "text-muted-foreground"
                  }`}
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={() => setHasDiscomfort(true)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    hasDiscomfort
                      ? "bg-blue-600 text-white"
                      : "text-muted-foreground"
                  }`}
                >
                  Sí
                </button>
              </div>
            </div>

            {hasDiscomfort && (
              <div className="space-y-3 pt-2 border-t border-border/40 animate-in fade-in duration-200">
                <div>
                  <label className="text-xs text-muted-foreground font-medium block mb-1.5">
                    ¿En qué zona corporal?
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {bodyParts.map((part) => (
                      <button
                        key={part}
                        type="button"
                        onClick={() => setDiscomfortPart(part)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all ${
                          discomfortPart === part
                            ? "bg-blue-500/10 border-blue-500 text-blue-600 dark:text-blue-400 font-bold"
                            : "bg-card border-border/50 text-foreground hover:bg-card/80"
                        }`}
                      >
                        {part}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Part Input if "Otro" selected */}
                {discomfortPart === "Otro" && (
                  <div className="animate-in fade-in duration-200">
                    <label className="text-xs text-muted-foreground font-medium block mb-1">
                      Especifica la molestia:
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Planta del pie, Trapecio..."
                      value={customDiscomfortPart}
                      onChange={(e) => setCustomDiscomfortPart(e.target.value)}
                      className="w-full p-3 rounded-xl bg-card border border-blue-500/40 text-xs text-foreground focus:outline-none focus:border-blue-500"
                    />
                  </div>
                )}

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs text-muted-foreground font-medium">
                      Intensidad de la molestia
                    </label>
                    <span className="text-xs font-bold text-blue-500">
                      {discomfortIntensity} / 10
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={discomfortIntensity}
                    onChange={(e) => setDiscomfortIntensity(parseInt(e.target.value))}
                    className="w-full accent-blue-600 cursor-pointer h-2 bg-accent rounded-lg"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Optional Comments Collapsible Section */}
          <div className="bg-accent/30 rounded-2xl p-3.5 border border-border/40">
            {!showComments ? (
              <button
                type="button"
                onClick={() => setShowComments(true)}
                className="w-full py-2 flex items-center justify-center gap-2 text-xs font-semibold text-blue-500 hover:text-blue-400 transition-colors"
              >
                <MessageSquarePlus className="w-4 h-4" />
                <span>+ Añadir comentario opcional</span>
              </button>
            ) : (
              <div className="space-y-2 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <MessageSquarePlus className="w-4 h-4 text-blue-500" />
                    Comentario adicional (opcional)
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowComments(false)}
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Ocultar
                  </button>
                </div>
                <textarea
                  rows={2}
                  placeholder="Detalles sobre tu descanso, nutrición o Sensaciones..."
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  className="w-full p-3 rounded-xl bg-card border border-border/50 text-xs text-foreground focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>
            )}
          </div>

          {/* Submit Button ("Enviar") */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 mt-2"
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
        </form>
      </div>
    </div>
  );
}
