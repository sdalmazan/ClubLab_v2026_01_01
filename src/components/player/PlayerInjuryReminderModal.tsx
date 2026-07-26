"use client";

import React from "react";
import { HeartPulse, PlusCircle, Clock, ShieldCheck, Check } from "lucide-react";

interface PlayerInjuryReminderModalProps {
  isOpen: boolean;
  onCloseLater: () => void;
  onOpenInjuryModal: () => void;
  onMarkAsClean: () => void;
}

export function PlayerInjuryReminderModal({
  isOpen,
  onCloseLater,
  onOpenInjuryModal,
  onMarkAsClean,
}: PlayerInjuryReminderModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-md rounded-3xl border border-border shadow-2xl overflow-hidden p-6 space-y-5 relative">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 shadow-md">
          <HeartPulse className="w-7 h-7" />
        </div>

        <div className="text-center space-y-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
            Perfil de Salud y Prevención
          </span>
          <h2 className="text-xl font-bold text-foreground">
            Completa tu Histórico de Lesiones
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto">
            Para que los servicios médicos y el staff puedan adaptar tus cargas de entrenamiento y prevenir recaídas, es muy importante registrar tus lesiones anteriores o molestias recurrentes.
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-accent/40 border border-border/40 text-[11px] text-muted-foreground space-y-1.5">
          <div className="flex items-center gap-2 text-foreground font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Confidencialidad médica garantizada</span>
          </div>
          <p className="pl-6 text-[10.5px]">
            Tus registros médicos están protegidos bajo la ley de datos y solo los servicios de fisioterapia/médicos accederán a tu historial detallado.
          </p>
        </div>

        <div className="space-y-2.5 pt-1">
          <button
            onClick={onOpenInjuryModal}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Añadir Lesión o Antecedente Médico</span>
          </button>

          <button
            onClick={onMarkAsClean}
            className="w-full py-2.5 bg-accent/60 hover:bg-accent text-foreground font-semibold text-xs rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Check className="w-4 h-4 text-emerald-400" />
            <span>No tengo lesiones previas (Marcar al día)</span>
          </button>

          <button
            onClick={onCloseLater}
            className="w-full py-2 text-muted-foreground hover:text-foreground font-medium text-[11px] flex items-center justify-center gap-1 transition-colors cursor-pointer"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Recordarme en el próximo inicio de sesión</span>
          </button>
        </div>
      </div>
    </div>
  );
}
