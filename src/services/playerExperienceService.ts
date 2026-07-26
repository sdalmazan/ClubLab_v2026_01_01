/**
 * ClubLab Player Experience Service
 * Handles data access for player check-ins, check-outs, recommendations,
 * progressive profile completion, match stats, standings, confidential injuries, and settings.
 */

import {
  Player,
  PlayerWellnessCheckin,
  PlayerRecommendation,
  PlayerPrivacyRequest,
} from "@/types";

export interface PlayerDailySummary {
  player: Partial<Player>;
  status: "GOOD" | "READY" | "RECOVER" | "ATTENTION";
  statusMessage: string;
  checkinPending: boolean;
  checkinWindowOpen: boolean;
  checkinNextWindowTime?: string;
  checkoutPending: boolean;
  checkoutWindowOpen: boolean;
  activeRecommendation: PlayerRecommendation | null;
  completionPercentage: number;
  missingFields: Array<{ key: string; label: string; explanation: string }>;
  metricsSummary: {
    sleepQuality: number; // 1-5
    fatigue: number; // 1-5
    weeklyLoadChangePercent: number;
    hasDiscomfort: boolean;
    discomfortLocation: string | null;
    acwrRatio: number; // e.g. 1.05
    gpsDistanceKm: number; // e.g. 6.4
  };
}

export interface TeamComparisonData {
  metricLabel: string;
  playerValue: number;
  teamAverage: number;
  teamMin: number;
  teamMax: number;
  unit: string;
  statusBadge: "above" | "optimal" | "below";
}

export interface PlayerMatchSummary {
  id: string;
  opponentName: string;
  opponentLogoUrl?: string;
  date: string;
  isHome: boolean;
  scoreHome: number;
  scoreAway: number;
  isStarter: boolean;
  minutesPlayed: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  matchType: "Oficial" | "Amistoso";
}

export interface SeasonAccumulatedStats {
  matchesPlayed: number;
  starts: number;
  totalMinutes: number;
  totalGoals: number;
  totalAssists: number;
  yellowCards: number;
  redCards: number;
}

export interface StandingTeamRow {
  position: number;
  teamName: string;
  isCurrentTeam: boolean;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface ConfidentialInjuryInput {
  injuryType: string;
  bodyPart: string;
  occurredDate: string;
  estimatedReturnDays?: number;
  isConfidential: boolean; // Confidencial = Only Physio/Medical staff
  notes?: string;
}

export function getMockPlayerSummary(): PlayerDailySummary {
  return {
    player: {
      id: "demo-player-1",
      first_name: "Diego",
      last_name: "Almazán",
      sporting_name: "Diego A.",
      height_cm: 182,
      weight_kg: 76,
      dominant_foot: "right",
      physical_status: "green",
      availability_status: "available",
      avatar_url: null,
      date_of_birth: "2000-05-14",
    },
    status: "READY",
    statusMessage: "Tu recuperación está en tu rango habitual.",
    checkinPending: true,
    checkinWindowOpen: true,
    checkoutPending: false,
    checkoutWindowOpen: true,
    activeRecommendation: {
      id: "rec-1",
      organization_id: "org-1",
      player_id: "demo-player-1",
      category: "prevencion",
      title: "Prevención de Isquiotibiales",
      description: "Rutina suave de 8 minutos para reforzar el tono de isquios tras el entrenamiento de ayer.",
      reason_context: "Tu carga acumulada en los últimos 3 días ha aumentado un +8%.",
      exercise_routine_id: null,
      estimated_minutes: 8,
      is_completed: false,
      created_by: "staff-1",
      created_at: new Date().toISOString(),
    },
    completionPercentage: 75,
    missingFields: [
      {
        key: "dominant_foot",
        label: "Pie dominante",
        explanation: "Permite al cuerpo técnico personalizar tus ejercicios tácticos.",
      },
      {
        key: "previous_injuries",
        label: "Historial de lesiones previas",
        explanation: "Nos ayuda a enviarte rutinas preventivas a medida.",
      },
    ],
    metricsSummary: {
      sleepQuality: 4,
      fatigue: 2,
      weeklyLoadChangePercent: 6,
      hasDiscomfort: false,
      discomfortLocation: null,
      acwrRatio: 1.05,
      gpsDistanceKm: 6.8,
    },
  };
}

export function getMockTeamComparisons(): TeamComparisonData[] {
  return [
    {
      metricLabel: "Puntuación de Recuperación",
      playerValue: 84,
      teamAverage: 76,
      teamMin: 61,
      teamMax: 92,
      unit: "/100",
      statusBadge: "above",
    },
    {
      metricLabel: "Calidad de Sueño (Media 7d)",
      playerValue: 8.2,
      teamAverage: 7.8,
      teamMin: 6.0,
      teamMax: 9.0,
      unit: "h",
      statusBadge: "optimal",
    },
    {
      metricLabel: "Carga Semanal Acumulada",
      playerValue: 1450,
      teamAverage: 1380,
      teamMin: 1100,
      teamMax: 1750,
      unit: "AU",
      statusBadge: "optimal",
    },
    {
      metricLabel: "Distancia GPS por Sesión",
      playerValue: 6.8,
      teamAverage: 6.2,
      teamMin: 4.8,
      teamMax: 8.1,
      unit: "km",
      statusBadge: "optimal",
    },
  ];
}

export function getMockPlayerMatches(): PlayerMatchSummary[] {
  return [
    {
      id: "m-1",
      opponentName: "CD Numancia B",
      date: "2026-07-19",
      isHome: true,
      scoreHome: 2,
      scoreAway: 1,
      isStarter: true,
      minutesPlayed: 85,
      goals: 1,
      assists: 1,
      yellowCards: 0,
      redCards: 0,
      matchType: "Amistoso",
    },
    {
      id: "m-2",
      opponentName: "Sigüenza",
      date: "2026-07-12",
      isHome: false,
      scoreHome: 0,
      scoreAway: 3,
      isStarter: true,
      minutesPlayed: 90,
      goals: 2,
      assists: 0,
      yellowCards: 1,
      redCards: 0,
      matchType: "Amistoso",
    },
  ];
}

export function getMockSeasonStats(): SeasonAccumulatedStats {
  return {
    matchesPlayed: 14,
    starts: 12,
    totalMinutes: 1120,
    totalGoals: 6,
    totalAssists: 4,
    yellowCards: 2,
    redCards: 0,
  };
}

export function getMockLeagueStandings(): StandingTeamRow[] {
  return [
    { position: 1, teamName: "SD Almazán", isCurrentTeam: true, played: 14, won: 10, drawn: 3, lost: 1, goalsFor: 28, goalsAgainst: 10, points: 33 },
    { position: 2, teamName: "CD Numancia B", isCurrentTeam: false, played: 14, won: 9, drawn: 4, lost: 1, goalsFor: 25, goalsAgainst: 12, points: 31 },
    { position: 3, teamName: "Real Ávila", isCurrentTeam: false, played: 14, won: 8, drawn: 4, lost: 2, goalsFor: 22, goalsAgainst: 14, points: 28 },
    { position: 4, teamName: "Palencia CF", isCurrentTeam: false, played: 14, won: 7, drawn: 4, lost: 3, goalsFor: 20, goalsAgainst: 15, points: 25 },
    { position: 5, teamName: "Burgos Promesas", isCurrentTeam: false, played: 14, won: 6, drawn: 5, lost: 3, goalsFor: 18, goalsAgainst: 14, points: 23 },
  ];
}

export function calculateProfileCompletion(player: Partial<Player>): {
  percentage: number;
  missingFields: Array<{ key: string; label: string; explanation: string }>;
} {
  const fields = [
    { key: "date_of_birth", label: "Año de Nacimiento", explanation: "Permite calcular tus rangos de frecuencia cardíaca óptima.", val: player.date_of_birth },
    { key: "height_cm", label: "Altura", explanation: "Nos ayuda a contextualizar tus métricas biomecánicas.", val: player.height_cm },
    { key: "weight_kg", label: "Peso", explanation: "Permite calcular tus necesidades de hidratación y carga.", val: player.weight_kg },
    { key: "dominant_foot", label: "Pie Dominante", explanation: "Ayuda a personalizar tus análisis de rendimiento.", val: player.dominant_foot },
  ];

  const completed = fields.filter((f) => f.val !== null && f.val !== undefined && f.val !== "");
  const percentage = Math.round((completed.length / fields.length) * 100);
  const missingFields = fields.filter((f) => !f.val).map(({ key, label, explanation }) => ({ key, label, explanation }));

  return { percentage, missingFields };
}
