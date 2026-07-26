export type TalkRequestStatus = "pending" | "accepted" | "rejected" | "counter_proposal";

export type TalkTopic =
  | "rendimiento"
  | "tactico"
  | "minutos"
  | "fisico"
  | "lesion"
  | "personal"
  | "otro";

export interface TalkRequest {
  id: string;
  sender_type: "player" | "coach";
  sender_id: string;
  sender_name: string;
  recipient_type: "player" | "coach";
  recipient_id: string;
  recipient_name: string;
  player_id: string;
  player_name: string;
  team_name?: string;
  topic: TalkTopic | string;
  topic_custom?: string;
  proposed_date?: string; // YYYY-MM-DD
  proposed_time?: string; // HH:mm
  location?: string;
  notes?: string;
  status: TalkRequestStatus;
  counter_date?: string;
  counter_time?: string;
  response_notes?: string;
  created_at: string;
  updated_at: string;
}

export const TALK_TOPIC_LABELS: Record<TalkTopic, string> = {
  rendimiento: "📊 Revisión de Rendimiento",
  tactico: "📋 Dudas Tácticas / Modelo de Juego",
  minutos: "⏱️ Minutos y Rol en la Plantilla",
  fisico: "💪 Estado Físico y Carga",
  lesion: "🏥 Enfermería y Readaptación",
  personal: "🤝 Asunto Personal",
  otro: "💬 Otro tema",
};
