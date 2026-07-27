"use client";

import React, { useState } from "react";
import Link from "next/link";
import { PlayerBottomNav } from "@/components/player/PlayerBottomNav";
import { ProfileCompletionBar } from "@/components/player/ProfileCompletionBar";
import { PlayerProfileEditModal } from "@/components/player/PlayerProfileEditModal";
import { PlayerSettingsModal } from "@/components/player/PlayerSettingsModal";
import { User, ShieldCheck, Dumbbell, Activity, HeartPulse, ChevronRight, Lock, Settings, Edit3 } from "lucide-react";
import { getMockPlayerSummary } from "@/services/playerExperienceService";

export default function PlayerProfilePage() {
  const summary = getMockPlayerSummary();
  const player = summary.player;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [focusedField, setFocusedField] = useState<string | undefined>();

  const handleOpenEdit = (fieldKey?: string) => {
    setFocusedField(fieldKey);
    setEditModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 px-4 py-6 max-w-lg mx-auto space-y-5">
      {/* Header Profile Hero */}
      <div className="rounded-3xl border border-blue-500/30 bg-card p-6 shadow-xl relative overflow-hidden flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-black text-2xl flex items-center justify-center shadow-lg border-2 border-background">
            {player.first_name?.[0]}
            {player.last_name?.[0]}
          </div>
          <div>
            <span className="text-[11px] font-bold text-blue-500 uppercase tracking-wider">
              Perfil del Jugador
            </span>
            <h1 className="text-xl font-black text-foreground tracking-tight">
              {player.first_name} {player.last_name}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              SD Almazán • #10
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenEdit()}
            className="p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1"
            title="Editar Mi Perfil"
          >
            <Edit3 className="w-4 h-4" />
          </button>

          <button
            onClick={() => setSettingsOpen(true)}
            className="p-3 bg-accent hover:bg-accent/80 text-foreground rounded-2xl border border-border/50 transition-all active:scale-95 cursor-pointer"
            title="Ajustes del Jugador"
          >
            <Settings className="w-5 h-5 text-blue-500" />
          </button>
        </div>
      </div>

      {/* Profile Completion Bar */}
      <ProfileCompletionBar
        percentage={summary.completionPercentage}
        missingFields={summary.missingFields}
        onCompleteField={(key) => handleOpenEdit(key)}
      />

      {/* Section: Privacy & Data Governance Button */}
      <Link
        href="/player/profile/privacy"
        className="rounded-3xl border border-blue-500/30 bg-gradient-to-r from-blue-500/10 via-card to-card p-5 shadow-lg flex items-center justify-between group hover:border-blue-500 transition-all"
      >
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-sm">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Privacy Center & Consentimientos</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Gestiona quién ve tus datos, consentimientos y descargas RGPD.
            </p>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-blue-500 group-hover:translate-x-1 transition-transform" />
      </Link>

      {/* Categorized Data Cards */}
      <div className="space-y-4">
        {/* Datos Personales */}
        <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-lg space-y-3">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-blue-500" />
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Datos Personales
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-3 rounded-2xl bg-accent/30 border border-border/40">
              <span className="text-muted-foreground block">Año Nacimiento</span>
              <span className="font-bold text-foreground">2000 (26 años)</span>
            </div>
            <div className="p-3 rounded-2xl bg-accent/30 border border-border/40">
              <span className="text-muted-foreground block">Nacionalidad</span>
              <span className="font-bold text-foreground">Española</span>
            </div>
          </div>
        </div>

        {/* Datos Físicos */}
        <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-lg space-y-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-500" />
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Datos Físicos
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-3 rounded-2xl bg-accent/30 border border-border/40">
              <span className="text-muted-foreground block">Altura</span>
              <span className="font-bold text-foreground">{player.height_cm} cm</span>
            </div>
            <div className="p-3 rounded-2xl bg-accent/30 border border-border/40">
              <span className="text-muted-foreground block">Peso</span>
              <span className="font-bold text-foreground">{player.weight_kg} kg</span>
            </div>
          </div>
        </div>

        {/* Datos Deportivos */}
        <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-lg space-y-3">
          <div className="flex items-center gap-2">
            <Dumbbell className="w-4 h-4 text-blue-500" />
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Datos Deportivos
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-3 rounded-2xl bg-accent/30 border border-border/40">
              <span className="text-muted-foreground block">Posición</span>
              <span className="font-bold text-foreground">Mediapunta</span>
            </div>
            <div className="p-3 rounded-2xl bg-accent/30 border border-border/40">
              <span className="text-muted-foreground block">Pie Dominante</span>
              <span className="font-bold text-foreground">Diestro</span>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      <PlayerProfileEditModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        initialFieldFocus={focusedField}
      />

      {/* Settings Modal */}
      <PlayerSettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      {/* Mobile Navigation */}
      <PlayerBottomNav />
    </div>
  );
}
