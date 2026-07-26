"use client";

import React, { useState } from "react";
import { X, Calendar, Clock, MessageSquare, MapPin, Send, Sparkles } from "lucide-react";
import { TALK_TOPIC_LABELS, TalkTopic } from "@/types/talks";
import { createTalkRequest } from "@/services/talksService";

interface RequestTalkModalProps {
  isOpen: boolean;
  onClose: () => void;
  senderType: "player" | "coach";
  playerId: string;
  playerName: string;
  onSuccess?: () => void;
}

export function RequestTalkModal({
  isOpen,
  onClose,
  senderType,
  playerId,
  playerName,
  onSuccess,
}: RequestTalkModalProps) {
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  const [topic, setTopic] = useState<TalkTopic>("rendimiento");
  const [topicCustom, setTopicCustom] = useState("");
  const [proposedDate, setProposedDate] = useState(tomorrowStr);
  const [proposedTime, setProposedTime] = useState("12:00");
  const [location, setLocation] = useState(
    senderType === "coach" ? "Despacho del Míster" : "Instalaciones del Club"
  );
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      createTalkRequest({
        sender_type: senderType,
        recipient_type: senderType === "player" ? "coach" : "player",
        player_id: playerId,
        player_name: playerName,
        sender_name: senderType === "player" ? playerName : "Cuerpo Técnico / Míster",
        recipient_name: senderType === "player" ? "Entrenador / Míster" : playerName,
        topic,
        topic_custom: topic === "otro" ? topicCustom : undefined,
        proposed_date: proposedDate,
        proposed_time: proposedTime,
        location,
        notes,
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error("Error creating talk request:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 bg-slate-950/40">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded">
                💬 Cita Individual
              </span>
            </div>
            <h3 className="text-lg font-black text-white">
              {senderType === "player"
                ? "Solicitar Charla con el Entrenador"
                : `Solicitar Charla a ${playerName}`}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Target Info Pill */}
          <div className="p-3 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-white">
                {senderType === "player" ? "Destinatario:" : "Jugador:"}
              </span>
              <span className="text-emerald-400 font-extrabold">
                {senderType === "player" ? "Míster / Cuerpo Técnico" : playerName}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 italic">S.D. Almazán</span>
          </div>

          {/* Topic Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 block">
              Motivo / Tema Principal:
            </label>
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value as TalkTopic)}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {Object.entries(TALK_TOPIC_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>

            {topic === "otro" && (
              <input
                type="text"
                placeholder="Especifica el motivo..."
                value={topicCustom}
                onChange={(e) => setTopicCustom(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-2.5 text-xs text-white mt-2 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
                required
              />
            )}
          </div>

          {/* Proposed Date & Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                <Calendar className="size-3.5 text-primary" /> Propuesta de Fecha:
              </label>
              <input
                type="date"
                value={proposedDate}
                onChange={(e) => setProposedDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                <Clock className="size-3.5 text-primary" /> Propuesta de Hora:
              </label>
              <input
                type="time"
                value={proposedTime}
                onChange={(e) => setProposedTime(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                required
              />
            </div>
          </div>

          {/* Location */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
              <MapPin className="size-3.5 text-primary" /> Lugar / Ubicación:
            </label>
            <input
              type="text"
              placeholder="Ej. Despacho Míster, Vestuario, Zona de prensa..."
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Notes / Details */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
              <MessageSquare className="size-3.5 text-primary" /> Notas u Observaciones:
            </label>
            <textarea
              rows={3}
              placeholder="Detalla brevemente lo que te gustaría comentar..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-white/10 hover:bg-white/5 rounded-xl text-xs font-bold text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
            >
              <Send className="size-3.5" />
              {isSubmitting ? "Enviando..." : "Enviar Solicitud"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
