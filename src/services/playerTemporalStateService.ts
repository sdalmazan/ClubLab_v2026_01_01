/**
 * Player Temporal State Machine Service
 * ClubLab v2026.01.02
 * Pure, centralized, 100% testable service for player daily state evaluation.
 */

export type PlayerTemporalState =
  | "NO_SESSION"
  | "SESSION_CANCELLED"
  | "PRE_CHECKIN_NOT_OPEN"
  | "PRE_CHECKIN_OPEN"
  | "CHECKIN_DONE_WAITING_SESSION"
  | "SESSION_IN_PROGRESS"
  | "POST_SESSION_CHECKOUT_OPEN"
  | "CHECKOUT_DONE"
  | "SESSION_COMPLETED_WITHOUT_CHECKIN"
  | "SESSION_COMPLETED_WITHOUT_CHECKOUT"
  | "SESSION_DATA_ERROR";

export interface SessionData {
  id: string;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:mm or HH:mm:ss
  end_time?: string | null;
  duration_min?: number | null;
  status?: string | null; // 'scheduled' | 'active' | 'completed' | 'cancelled'
}

export interface PlayerDailyData {
  hasCheckinToday: boolean;
  hasCheckoutToday: boolean;
  checkinTime?: Date | null;
  checkoutTime?: Date | null;
}

export interface EvalStateOptions {
  session: SessionData | null;
  playerDaily: PlayerDailyData;
  nowTime?: Date;
  defaultSessionDurationMin?: number;
  preCheckinWindowHours?: number;
}

/**
 * Calculates the exact or estimated session end time.
 * Priority:
 * 1. Explicit end_time string.
 * 2. start_time + duration_min.
 * 3. start_time + defaultSessionDurationMin (fallback 90 min).
 * 4. start_time fallback.
 */
export function calculateSessionEnd(
  sessionDateStr: string,
  startTimeStr: string,
  endTimeStr?: string | null,
  durationMin?: number | null,
  defaultDurationMin: number = 90
): { startDate: Date; endDate: Date } {
  const [year, month, day] = sessionDateStr.split("-").map(Number);
  const [startH, startM] = startTimeStr.split(":").map(Number);

  const startDate = new Date(year, month - 1, day, startH || 10, startM || 0, 0);

  if (endTimeStr) {
    const [endH, endM] = endTimeStr.split(":").map(Number);
    const endDate = new Date(year, month - 1, day, endH || startH || 11, endM || 30, 0);
    if (endDate <= startDate) {
      endDate.setDate(endDate.getDate() + 1); // Handles sessions spanning midnight
    }
    return { startDate, endDate };
  }

  const duration = durationMin && durationMin > 0 ? durationMin : defaultDurationMin;
  const endDate = new Date(startDate.getTime() + duration * 60 * 1000);
  return { startDate, endDate };
}

/**
 * Evaluates the player's temporal state machine cleanly and deterministically.
 */
export function evalPlayerTemporalState(options: EvalStateOptions): {
  state: PlayerTemporalState;
  nextActionTitle: string;
  nextActionSubtitle: string;
  actionType: "none" | "checkin" | "checkout" | "done" | "waiting";
} {
  const {
    session,
    playerDaily,
    nowTime = new Date(),
    defaultSessionDurationMin = 90,
    preCheckinWindowHours = 4,
  } = options;

  if (!session) {
    return {
      state: "NO_SESSION",
      nextActionTitle: "Sin Entrenamiento Programado Hoy",
      nextActionSubtitle: "Disfruta de tu jornada de descanso o sigue tus pautas individuales.",
      actionType: "none",
    };
  }

  if (session.status === "cancelled") {
    return {
      state: "SESSION_CANCELLED",
      nextActionTitle: "Sesión Cancelada por el Cuerpo Técnico",
      nextActionSubtitle: "No se requiere check-in ni check-out para el entrenamiento de hoy.",
      actionType: "none",
    };
  }

  if (!session.date || !session.start_time) {
    return {
      state: "SESSION_DATA_ERROR",
      nextActionTitle: "Información de Sesión Incompleta",
      nextActionSubtitle: "Contacta con el staff para verificar los horarios del equipo.",
      actionType: "none",
    };
  }

  const { startDate, endDate } = calculateSessionEnd(
    session.date,
    session.start_time,
    session.end_time,
    session.duration_min,
    defaultSessionDurationMin
  );

  const preCheckinOpenDate = new Date(startDate.getTime() - preCheckinWindowHours * 60 * 60 * 1000);
  const checkoutOpenDate = new Date(endDate.getTime() - 15 * 60 * 1000); // 15 mins before end time
  const checkoutExpiryDate = new Date(endDate.getTime() + 12 * 60 * 60 * 1000); // 12h post session

  const { hasCheckinToday, hasCheckoutToday } = playerDaily;

  // State 8: Checkout Done
  if (hasCheckoutToday) {
    return {
      state: "CHECKOUT_DONE",
      nextActionTitle: "Check-out RPE Completado",
      nextActionSubtitle: "Tu registro de esfuerzo y recuperación ha sido guardado exitosamente.",
      actionType: "done",
    };
  }

  // State 7: Post-Session Checkout Open
  if (nowTime >= checkoutOpenDate && nowTime <= checkoutExpiryDate) {
    return {
      state: "POST_SESSION_CHECKOUT_OPEN",
      nextActionTitle: "Completa tu Check-out RPE Post-Sesión",
      nextActionSubtitle: "Evalúa la percepción del esfuerzo (RPE) del entrenamiento finalizado.",
      actionType: "checkout",
    };
  }

  // State 10: Session completed without checkout > 12h
  if (nowTime > checkoutExpiryDate) {
    return {
      state: "SESSION_COMPLETED_WITHOUT_CHECKOUT",
      nextActionTitle: "Plazo de Check-out Expirado",
      nextActionSubtitle: "El período de registro de esfuerzo post-sesión de hoy ha concluido.",
      actionType: "none",
    };
  }

  // State 6: Session In Progress
  if (nowTime >= startDate && nowTime < checkoutOpenDate) {
    if (hasCheckinToday) {
      return {
        state: "SESSION_IN_PROGRESS",
        nextActionTitle: "Entrenamiento en Curso",
        nextActionSubtitle: "Concéntrate en la sesión. El Check-out RPE se abrirá al finalizar el trabajo.",
        actionType: "waiting",
      };
    } else {
      return {
        state: "SESSION_IN_PROGRESS",
        nextActionTitle: "Entrenamiento en Curso (Sin Check-in)",
        nextActionSubtitle: "El entrenamiento ya ha comenzado. El Check-out RPE se habilitará al terminar.",
        actionType: "waiting",
      };
    }
  }

  // State 3, 4, 5: Pre-Session States
  if (nowTime < startDate) {
    if (hasCheckinToday) {
      return {
        state: "CHECKIN_DONE_WAITING_SESSION",
        nextActionTitle: "Check-in Pre-Entrenamiento Registrado",
        nextActionSubtitle: "Estás preparado para entrenar. Buen trabajo y ¡a darlo todo en el campo!",
        actionType: "done",
      };
    }

    if (nowTime >= preCheckinOpenDate) {
      return {
        state: "PRE_CHECKIN_OPEN",
        nextActionTitle: "Completa tu Check-in Pre-Entrenamiento",
        nextActionSubtitle: "Registra tus niveles de sueño, fatiga y molestias antes de empezar.",
        actionType: "checkin",
      };
    }

    return {
      state: "PRE_CHECKIN_NOT_OPEN",
      nextActionTitle: "Próxima Sesión Programada",
      nextActionSubtitle: `El Check-in se abrirá ${preCheckinWindowHours} horas antes del entrenamiento (${session.start_time.slice(0, 5)}h).`,
      actionType: "waiting",
    };
  }

  // Default Fallback
  return {
    state: "SESSION_COMPLETED_WITHOUT_CHECKIN",
    nextActionTitle: "Sesión Finalizada",
    nextActionSubtitle: "Revisa las recomendaciones del staff y la ficha del entrenamiento.",
    actionType: "none",
  };
}
