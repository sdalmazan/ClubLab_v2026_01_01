import { TalkRequest, TalkRequestStatus } from "@/types/talks";

const STORAGE_KEY = "clublab_talk_requests_v1";

const INITIAL_MOCK_TALKS: TalkRequest[] = [
  {
    id: "talk-1",
    sender_type: "coach",
    sender_id: "coach-1",
    sender_name: "Diego Ciria (Míster)",
    recipient_type: "player",
    recipient_id: "p-1",
    recipient_name: "Gonzalo de Miguel",
    player_id: "p-1",
    player_name: "Gonzalo de Miguel",
    team_name: "S.D. Almazán",
    topic: "tactico",
    proposed_date: new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0],
    proposed_time: "11:30",
    location: "Despacho del Míster / Vestuario Técnico",
    notes: "Repaso de movimientos defensivos a balón parado del último encuentro.",
    status: "pending",
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    id: "talk-2",
    sender_type: "player",
    sender_id: "p-2",
    sender_name: "Dani Martínez",
    recipient_type: "coach",
    recipient_id: "coach-1",
    recipient_name: "Cuerpo Técnico S.D. Almazán",
    player_id: "p-2",
    player_name: "Dani Martínez",
    team_name: "S.D. Almazán",
    topic: "fisico",
    proposed_date: new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0],
    proposed_time: "17:45",
    location: "Instalaciones de entrenamiento",
    notes: "Sensaciones de fatiga acumulada en los gemelos tras la doble sesión.",
    status: "accepted",
    response_notes: "Perfecto Dani, lo vemos en el vestuario antes de la sesión matinal.",
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 43200000).toISOString(),
  },
];

function getStoredTalks(): TalkRequest[] {
  if (typeof window === "undefined") return INITIAL_MOCK_TALKS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_MOCK_TALKS));
      return INITIAL_MOCK_TALKS;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error("Error reading stored talk requests:", err);
    return INITIAL_MOCK_TALKS;
  }
}

function saveStoredTalks(talks: TalkRequest[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(talks));
  } catch (err) {
    console.error("Error saving talk requests:", err);
  }
}

export function getTalkRequestsForPlayer(playerId?: string): TalkRequest[] {
  const all = getStoredTalks();
  if (!playerId) return all;
  return all.filter(
    (t) => t.player_id === playerId || t.recipient_id === playerId || t.sender_id === playerId
  );
}

export function getTalkRequestsForCoach(): TalkRequest[] {
  return getStoredTalks();
}

export function createTalkRequest(payload: {
  sender_type: "player" | "coach";
  sender_id?: string;
  sender_name?: string;
  recipient_type: "player" | "coach";
  recipient_id?: string;
  recipient_name?: string;
  player_id: string;
  player_name: string;
  team_name?: string;
  topic: string;
  topic_custom?: string;
  proposed_date?: string;
  proposed_time?: string;
  location?: string;
  notes?: string;
}): TalkRequest {
  const talks = getStoredTalks();

  const newTalk: TalkRequest = {
    id: `talk-${Date.now()}`,
    sender_type: payload.sender_type,
    sender_id: payload.sender_id || (payload.sender_type === "player" ? payload.player_id : "coach-1"),
    sender_name: payload.sender_name || (payload.sender_type === "player" ? payload.player_name : "Míster / Cuerpo Técnico"),
    recipient_type: payload.recipient_type,
    recipient_id: payload.recipient_id || (payload.recipient_type === "player" ? payload.player_id : "coach-1"),
    recipient_name: payload.recipient_name || (payload.recipient_type === "player" ? payload.player_name : "Cuerpo Técnico"),
    player_id: payload.player_id,
    player_name: payload.player_name,
    team_name: payload.team_name || "S.D. Almazán",
    topic: payload.topic,
    topic_custom: payload.topic_custom,
    proposed_date: payload.proposed_date,
    proposed_time: payload.proposed_time,
    location: payload.location || (payload.sender_type === "coach" ? "Despacho del Míster" : "Vestuario"),
    notes: payload.notes,
    status: "pending",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  talks.unshift(newTalk);
  saveStoredTalks(talks);
  return newTalk;
}

export function respondToTalkRequest(
  id: string,
  action: "accept" | "counter" | "reject",
  data: {
    counter_date?: string;
    counter_time?: string;
    response_notes?: string;
  }
): TalkRequest | null {
  const talks = getStoredTalks();
  const index = talks.findIndex((t) => t.id === id);
  if (index === -1) return null;

  const target = { ...talks[index] };

  if (action === "accept") {
    target.status = "accepted";
    if (data.response_notes) target.response_notes = data.response_notes;
  } else if (action === "counter") {
    target.status = "counter_proposal";
    target.counter_date = data.counter_date || target.proposed_date;
    target.counter_time = data.counter_time || target.proposed_time;
    if (data.response_notes) target.response_notes = data.response_notes;
  } else if (action === "reject") {
    target.status = "rejected";
    if (data.response_notes) target.response_notes = data.response_notes;
  }

  target.updated_at = new Date().toISOString();
  talks[index] = target;
  saveStoredTalks(talks);
  return target;
}
