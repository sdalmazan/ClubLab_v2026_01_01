"use client";

import React, { useState, useEffect } from "react";
import { MessageSquare, Calendar, Clock, MapPin, Plus, CheckCircle2, AlertCircle, RefreshCw, XCircle } from "lucide-react";
import { TalkRequest, TALK_TOPIC_LABELS, TalkTopic } from "@/types/talks";
import { getTalkRequestsForPlayer, getTalkRequestsForCoach } from "@/services/talksService";
import { RequestTalkModal } from "./RequestTalkModal";
import { TalkResponseModal } from "./TalkResponseModal";

interface TalksManagerCardProps {
  viewerRole: "player" | "coach";
  playerId: string;
  playerName: string;
  title?: string;
  subtitle?: string;
}

export function TalksManagerCard({
  viewerRole,
  playerId,
  playerName,
  title = "Gestión de Charlas y Citas Individuales",
  subtitle = "Solicita o responde a citas individuales entre plantilla y cuerpo técnico",
}: TalksManagerCardProps) {
  const [talks, setTalks] = useState<TalkRequest[]>([]);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [selectedTalkToRespond, setSelectedTalkToRespond] = useState<TalkRequest | null>(null);

  const loadTalks = () => {
    if (viewerRole === "player") {
      setTalks(getTalkRequestsForPlayer(playerId));
    } else {
      setTalks(getTalkRequestsForCoach().filter((t) => t.player_id === playerId));
    }
  };

  useEffect(() => {
    loadTalks();
  }, [playerId, viewerRole]);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-lg">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded">
              💬 Interacción 1 a 1
            </span>
          </div>
          <h3 className="text-base font-black text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>

        <button
          onClick={() => setRequestModalOpen(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
        >
          <Plus className="size-4" />
          <span>Solicitar Charla</span>
        </button>
      </div>

      {/* List of Talks */}
      {talks.length === 0 ? (
        <div className="text-center py-8 bg-accent/20 border border-border/40 rounded-xl text-muted-foreground text-xs italic space-y-2">
          <p>No hay solicitudes de charla registradas actualmente.</p>
          <button
            onClick={() => setRequestModalOpen(true)}
            className="text-primary font-bold hover:underline text-xs"
          >
            + Enviar una propuesta de cita
          </button>
        </div>
      ) : (
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
          {talks.map((talk) => {
            const isPending = talk.status === "pending";
            const isAccepted = talk.status === "accepted";
            const isCounter = talk.status === "counter_proposal";
            const isRejected = talk.status === "rejected";

            const topicLabel =
              TALK_TOPIC_LABELS[talk.topic as TalkTopic] || talk.topic_custom || talk.topic;

            const isReceiver =
              (viewerRole === "player" && talk.recipient_type === "player") ||
              (viewerRole === "coach" && talk.recipient_type === "coach");

            return (
              <div
                key={talk.id}
                className="p-4 rounded-xl border border-border/60 bg-accent/30 space-y-2.5 transition-colors hover:border-border"
              >
                {/* Top status bar */}
                <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground text-sm">{topicLabel}</span>
                    <span className="text-[10px] text-muted-foreground">
                      De: <strong>{talk.sender_name}</strong>
                    </span>
                  </div>

                  {/* Status Badge */}
                  {isPending && (
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                      <Clock className="size-3" /> Pendiente
                    </span>
                  )}
                  {isAccepted && (
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                      <CheckCircle2 className="size-3" /> Confirmada
                    </span>
                  )}
                  {isCounter && (
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center gap-1">
                      <RefreshCw className="size-3" /> Nueva Fecha Propuesta
                    </span>
                  )}
                  {isRejected && (
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                      <XCircle className="size-3" /> Rechazada
                    </span>
                  )}
                </div>

                {/* Date & Location details */}
                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground bg-card/60 p-2.5 rounded-lg border border-border/40">
                  <span className="flex items-center gap-1 font-semibold text-foreground">
                    <Calendar className="size-3.5 text-primary" />
                    {isCounter ? talk.counter_date : talk.proposed_date || "Por concretar"}
                  </span>
                  <span className="flex items-center gap-1 font-semibold text-foreground">
                    <Clock className="size-3.5 text-primary" />
                    {isCounter ? talk.counter_time : talk.proposed_time || "—"} hs
                  </span>
                  {talk.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="size-3.5 text-primary" /> {talk.location}
                    </span>
                  )}
                </div>

                {/* Notes */}
                {talk.notes && (
                  <p className="text-xs text-muted-foreground italic">
                    "{talk.notes}"
                  </p>
                )}

                {/* Response Notes if any */}
                {talk.response_notes && (
                  <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20 text-xs space-y-0.5">
                    <span className="font-bold text-primary block text-[10px] uppercase">
                      Respuesta del receptor:
                    </span>
                    <p className="text-foreground italic">"{talk.response_notes}"</p>
                  </div>
                )}

                {/* Action button if receiver & pending */}
                {isReceiver && isPending && (
                  <div className="pt-1 flex justify-end">
                    <button
                      onClick={() => setSelectedTalkToRespond(talk)}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow transition-all cursor-pointer flex items-center gap-1"
                    >
                      <MessageSquare className="size-3.5" /> Responder Propuesta
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Request Modal */}
      <RequestTalkModal
        isOpen={requestModalOpen}
        onClose={() => setRequestModalOpen(false)}
        senderType={viewerRole}
        playerId={playerId}
        playerName={playerName}
        onSuccess={loadTalks}
      />

      {/* Response Modal */}
      <TalkResponseModal
        talk={selectedTalkToRespond}
        isOpen={!!selectedTalkToRespond}
        onClose={() => setSelectedTalkToRespond(null)}
        onSuccess={loadTalks}
      />
    </div>
  );
}
