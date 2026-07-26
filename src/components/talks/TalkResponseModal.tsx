"use client";

import React, { useState } from "react";
import { X, CheckCircle2, Clock, XCircle, Calendar, MessageSquare, AlertCircle } from "lucide-react";
import { TalkRequest, TALK_TOPIC_LABELS, TalkTopic } from "@/types/talks";
import { respondToTalkRequest } from "@/services/talksService";

interface TalkResponseModalProps {
  talk: TalkRequest | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function TalkResponseModal({
  talk,
  isOpen,
  onClose,
  onSuccess,
}: TalkResponseModalProps) {
  if (!isOpen || !talk) return null;

  const [mode, setMode] = useState<"accept" | "counter" | "reject">("accept");
  const [counterDate, setCounterDate] = useState(
    talk.proposed_date || new Date().toISOString().split("T")[0]
  );
  const [counterTime, setCounterTime] = useState(talk.proposed_time || "12:00");
  const [responseNotes, setResponseNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const topicText =
    TALK_TOPIC_LABELS[talk.topic as TalkTopic] || talk.topic_custom || talk.topic;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      respondToTalkRequest(talk.id, mode, {
        counter_date: mode === "counter" ? counterDate : undefined,
        counter_time: mode === "counter" ? counterTime : undefined,
        response_notes: responseNotes,
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error("Error responding to talk request:", err);
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
            <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded">
              Responder Solicitud de Cita
            </span>
            <h3 className="text-lg font-black text-white">
              Charla con {talk.sender_name}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Proposal Detail Summary */}
        <div className="p-5 bg-white/3 border-b border-white/10 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-white text-sm">{topicText}</span>
            <span className="text-[10px] font-extrabold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 uppercase">
              Pendiente
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-slate-300">
            {talk.proposed_date && (
              <span className="flex items-center gap-1">
                <Calendar className="size-3.5 text-primary" /> {talk.proposed_date}
              </span>
            )}
            {talk.proposed_time && (
              <span className="flex items-center gap-1">
                <Clock className="size-3.5 text-primary" /> {talk.proposed_time} hs
              </span>
            )}
            {talk.location && (
              <span className="text-slate-400">📍 {talk.location}</span>
            )}
          </div>

          {talk.notes && (
            <p className="text-slate-400 italic bg-slate-950/50 p-2.5 rounded-lg text-[11px] border border-white/5">
              "{talk.notes}"
            </p>
          )}
        </div>

        {/* Action Mode Switcher */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-3 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setMode("accept")}
              className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                mode === "accept"
                  ? "bg-emerald-600 text-white shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <CheckCircle2 className="size-3.5" /> Aceptar
            </button>
            <button
              type="button"
              onClick={() => setMode("counter")}
              className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                mode === "counter"
                  ? "bg-amber-600 text-white shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Clock className="size-3.5" /> Cambiar Fecha
            </button>
            <button
              type="button"
              onClick={() => setMode("reject")}
              className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                mode === "reject"
                  ? "bg-rose-600 text-white shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <XCircle className="size-3.5" /> Rechazar
            </button>
          </div>

          {/* Mode Inputs */}
          {mode === "accept" && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 space-y-1">
              <span className="font-bold flex items-center gap-1">
                <CheckCircle2 className="size-4" /> Confirmarás la propuesta directamente.
              </span>
              <p className="text-[11px] text-slate-300">
                Se notificará a {talk.sender_name} que la cita queda fijada para el {talk.proposed_date} a las {talk.proposed_time} hs.
              </p>
            </div>
          )}

          {mode === "counter" && (
            <div className="space-y-3 p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <span className="text-xs font-bold text-amber-300 flex items-center gap-1">
                <Clock className="size-4" /> Proponer Nueva Fecha y Hora (Contrapropuesta)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-300 uppercase">
                    Nueva Fecha:
                  </label>
                  <input
                    type="date"
                    value={counterDate}
                    onChange={(e) => setCounterDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-300 uppercase">
                    Nueva Hora:
                  </label>
                  <input
                    type="time"
                    value={counterTime}
                    onChange={(e) => setCounterTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {mode === "reject" && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 space-y-1">
              <span className="font-bold flex items-center gap-1">
                <XCircle className="size-4" /> Desestimar solicitud de charla.
              </span>
              <p className="text-[11px] text-slate-300">
                Se enviará una notificación a {talk.sender_name} informando que la cita ha sido rechazada.
              </p>
            </div>
          )}

          {/* Response Notes */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
              <MessageSquare className="size-3.5 text-primary" /> Mensaje / Respuesta (Opcional):
            </label>
            <textarea
              rows={2}
              placeholder="Ej. De acuerdo nos vemos en vestuario / Prefiero a esa hora..."
              value={responseNotes}
              onChange={(e) => setResponseNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
          </div>

          {/* Actions */}
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
              className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 text-slate-950 ${
                mode === "accept"
                  ? "bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/20"
                  : mode === "counter"
                  ? "bg-amber-500 hover:bg-amber-400 shadow-amber-500/20"
                  : "bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/20"
              }`}
            >
              {isSubmitting
                ? "Enviando..."
                : mode === "accept"
                ? "✅ Confirmar Charla"
                : mode === "counter"
                ? "🔄 Enviar Nueva Fecha"
                : "❌ Rechazar Charla"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
