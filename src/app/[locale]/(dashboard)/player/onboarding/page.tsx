"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowRight, ArrowLeft, Check, ShieldCheck, User, Activity, Dumbbell } from "lucide-react";

export default function PlayerOnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const totalSteps = 7;

  // Form State
  const [sportingName, setSportingName] = useState("Diego A.");
  const [birthYear, setBirthYear] = useState("2000");
  const [height, setHeight] = useState("182");
  const [weight, setWeight] = useState("76");
  const [position, setPosition] = useState("attacking_midfielder");
  const [dominantFoot, setDominantFoot] = useState("right");
  const [hasPreviousInjuries, setHasPreviousInjuries] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(true);

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      router.push("/player");
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between p-4 max-w-lg mx-auto">
      {/* Header & Progress Indicator */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="text-sm font-bold tracking-tight">ClubLab Player</span>
          </div>
          <span className="text-xs font-bold text-muted-foreground bg-accent px-3 py-1 rounded-full border border-border/40">
            Paso {step} de {totalSteps}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-accent h-2 rounded-full overflow-hidden p-0.5 border border-border/40">
          <div
            className="bg-primary h-full rounded-full transition-all duration-300"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* Step Content */}
      <div className="my-auto py-8">
        {step === 1 && (
          <div className="space-y-4 text-center animate-in fade-in duration-300">
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-3xl mx-auto flex items-center justify-center">
              <Sparkles className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black tracking-tight">Bienvenido a ClubLab</h1>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
              Tu centro personal de rendimiento. No es un formulario administrativo. Queremos ayudarte a entender cómo estás y cómo puedes mejorar.
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center gap-2 text-primary">
              <User className="w-5 h-5" />
              <h2 className="text-xl font-bold">Datos Básicos</h2>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Nombre Deportivo
                </label>
                <input
                  type="text"
                  value={sportingName}
                  onChange={(e) => setSportingName(e.target.value)}
                  className="w-full p-3.5 rounded-2xl bg-card border border-border/60 text-sm font-semibold focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Año de Nacimiento
                </label>
                <input
                  type="number"
                  value={birthYear}
                  onChange={(e) => setBirthYear(e.target.value)}
                  className="w-full p-3.5 rounded-2xl bg-card border border-border/60 text-sm font-semibold focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center gap-2 text-emerald-500">
              <Activity className="w-5 h-5" />
              <h2 className="text-xl font-bold">Datos Físicos (Opcionales)</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Nos ayuda a contextualizar tus necesidades de carga e hidratación.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Altura (cm)
                </label>
                <input
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  className="w-full p-3.5 rounded-2xl bg-card border border-border/60 text-sm font-semibold focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Peso (kg)
                </label>
                <input
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="w-full p-3.5 rounded-2xl bg-card border border-border/60 text-sm font-semibold focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center gap-2 text-blue-500">
              <Dumbbell className="w-5 h-5" />
              <h2 className="text-xl font-bold">Datos Deportivos</h2>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Pie Dominante
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: "right", label: "Diestro" },
                    { key: "left", label: "Zurdo" },
                    { key: "both", label: "Ambidiestro" },
                  ].map((foot) => (
                    <button
                      key={foot.key}
                      type="button"
                      onClick={() => setDominantFoot(foot.key)}
                      className={`p-3 rounded-2xl font-bold text-xs border transition-all ${
                        dominantFoot === foot.key
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card border-border/50 text-foreground"
                      }`}
                    >
                      {foot.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center gap-2 text-rose-500">
              <Activity className="w-5 h-5" />
              <h2 className="text-xl font-bold">Historial de Lesiones</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              ¿Has tenido lesiones importantes en los últimos 2 años?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setHasPreviousInjuries(false)}
                className={`flex-1 py-4 rounded-2xl font-bold text-sm border transition-all ${
                  !hasPreviousInjuries
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border/50 text-foreground"
                }`}
              >
                No
              </button>
              <button
                type="button"
                onClick={() => setHasPreviousInjuries(true)}
                className={`flex-1 py-4 rounded-2xl font-bold text-sm border transition-all ${
                  hasPreviousInjuries
                    ? "bg-amber-500 text-white border-amber-500"
                    : "bg-card border-border/50 text-foreground"
                }`}
              >
                Sí
              </button>
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center gap-2 text-emerald-500">
              <ShieldCheck className="w-5 h-5" />
              <h2 className="text-xl font-bold">Privacidad & Consentimientos</h2>
            </div>
            <div className="p-4 rounded-2xl bg-card border border-border/60 space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Tus datos de salud están protegidos bajo estándares RGPD. Puedes gestionar o revocar tus consentimientos en todo momento desde tu Privacy Center.
              </p>
              <label className="flex items-center gap-3 cursor-pointer pt-2 border-t border-border/40">
                <input
                  type="checkbox"
                  checked={consentAccepted}
                  onChange={(e) => setConsentAccepted(e.target.checked)}
                  className="w-5 h-5 accent-primary rounded-lg"
                />
                <span className="text-xs font-bold text-foreground">
                  Acepto el seguimiento de datos de rendimiento y salud (v1.0)
                </span>
              </label>
            </div>
          </div>
        )}

        {step === 7 && (
          <div className="space-y-4 text-center animate-in fade-in duration-300">
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-3xl mx-auto flex items-center justify-center">
              <Check className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black tracking-tight">¡Todo Listo!</h1>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
              Tu espacio de rendimiento ya está configurado. Disfruta de la experiencia ClubLab.
            </p>
          </div>
        )}
      </div>

      {/* Footer Nav Controls */}
      <div className="flex items-center gap-3 pb-4">
        {step > 1 && (
          <button
            onClick={handleBack}
            className="p-4 rounded-2xl bg-accent text-foreground font-bold text-sm border border-border/40 hover:bg-accent/80 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}

        <button
          onClick={handleNext}
          className="flex-1 py-4 rounded-2xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 shadow-lg hover:bg-primary/95 active:scale-[0.98] transition-all"
        >
          <span>{step === totalSteps ? "Ir a la App" : "Continuar"}</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
