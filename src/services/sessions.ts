/**
 * ClubLab v2026.01.01 — Sessions Service
 * Multi-tenant data access layer for training sessions, attendance, and session exercises.
 */

import { createClient } from "@/lib/supabase/server";
import type { TrainingSession } from "@/types";
import { logger } from '@/lib/logger';

export interface CreateSessionInput {
  team_id: string;
  season_id?: string | null;
  title: string;
  date: string;
  duration_min: number;
  session_type: string;
  microcycle_day?: string | null;
  planned_load?: string | null;
  planned_intensity?: string | null;
  objectives?: string[];
  tactical_concepts?: string[];
  muscle_groups?: string[];
  notes?: string | null;
  template_id?: string | null;
  status?: "planned" | "completed" | "cancelled";
  match_game_plan?: any | null;
  start_time?: string;
  checkin_hours_before?: number;
  checkin_close_mins_before?: number;
  checkout_mins_after?: number;
  checkout_close_hours_after?: number;
  mesocycle?: string | null;
  session_week_seq?: number | null;
  session_total_seq?: number | null;
  facility_ids?: string[] | null;
  attendance: Array<{
    player_id: string;
    status: "present" | "absent" | "injured" | "rest" | "other";
    notes?: string | null;
  }>;
  exercises: Array<{
    exercise_id: string;
    order_index: number;
    duration_min: number;
    recovery_min: number;
    pitch_zones: string[];
    equipment: Array<{ name: string; quantity: number }>;
    group_setup: {
      groups?: Array<{ name: string; players: string[] }>;
    };
    whiteboard_data?: any | null;
    whiteboard_zone?: string | null;
    space_dimensions?: string | null;
    tactical_concepts?: string[];
    muscle_groups?: string[];
  }>;
}

export function getMonday(dateStr: string) {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.setDate(diff));
  mon.setHours(0, 0, 0, 0);
  return mon;
}

export function enrichSessionsWithMetrics(sessions: any[]): any[] {
  if (!sessions || sessions.length === 0) return [];

  // Group by team_id
  const teamMap: Record<string, any[]> = {};
  sessions.forEach((s) => {
    const tId = s.team_id || "default";
    if (!teamMap[tId]) teamMap[tId] = [];
    teamMap[tId].push(s);
  });

  Object.keys(teamMap).forEach((tId) => {
    const list = teamMap[tId];
    // Sort ascending for accurate chronological indexing
    const sorted = [...list].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const firstMonday = sorted.length > 0 ? getMonday(sorted[0].date) : null;
    
    let collectiveCounter = 0;
    const metricsMap: Record<string, any> = {};

    sorted.forEach((s) => {
      const isCollective = s.session_type === "training" || s.session_type === "match";
      
      let totalSeq = null;
      let weekSeq = null;
      let micro = null;
      let meso = null;

      if (isCollective) {
        collectiveCounter++;
        totalSeq = collectiveCounter;
        
        if (firstMonday) {
          const sessionMonday = getMonday(s.date);
          micro = Math.round((sessionMonday.getTime() - firstMonday.getTime()) / (7 * 86400000)) + 1;
          if (micro < 1) micro = 1;
          
          const mesoNum = Math.floor((micro - 1) / 4) + 1;
          meso = `MESO ${mesoNum}`;
          
          const weekCollectives = sorted.filter((x: any) => 
            (x.session_type === "training" || x.session_type === "match") && 
            getMonday(x.date).getTime() === sessionMonday.getTime()
          );
          weekSeq = weekCollectives.findIndex((x: any) => x.id === s.id) + 1;
          if (weekSeq < 1) weekSeq = 1;
        }
      }

      metricsMap[s.id] = {
        metrics: {
          meso: meso || "",
          micro: micro || 1,
          orden_semana: weekSeq || 1,
          total_sesiones: totalSeq || 1
        },
        microcycle_day: weekSeq ? String(weekSeq) : ""
      };
    });

    // Assign back to original list preserving original order
    list.forEach((s) => {
      if (metricsMap[s.id]) {
        s.metrics = metricsMap[s.id].metrics;
        s.microcycle_day = metricsMap[s.id].microcycle_day;
      }
    });
  });

  return sessions;
}

/**
 * Recalculates sequential metrics for all sessions of a team in a single bulk upsert.
 * Replaces the previous N-query loop (N+1 anti-pattern) with a single DB operation.
 * Called after any session create, update, or delete.
 */
export async function recalculateAndSaveSessionMetrics(teamId: string, supabase: any) {
  if (!teamId) return;

  const { data: list, error } = await supabase
    .from("training_sessions")
    .select("id, date, team_id, session_type, title, organization_id, status, microcycle_day")
    .eq("team_id", teamId)
    .order("date", { ascending: true });

  if (error || !list || list.length === 0) return;

  const firstMonday = getMonday(list[0].date);

  let collectiveCounter = 0;
  const updates = list.map((s: any) => {
    const isCollective = s.session_type === "training" || s.session_type === "match";
    
    let totalSeq = null;
    let weekSeq = null;
    let micro = null;
    let meso = null;
    let updatedTitle = s.title;

    if (isCollective) {
      collectiveCounter++;
      totalSeq = collectiveCounter;
      
      // Auto-name training sessions to "Sesión X"
      if (s.session_type === "training") {
        updatedTitle = `Sesión ${totalSeq}`;
      }

      const sessionMonday = getMonday(s.date);
      micro = Math.round(
        (sessionMonday.getTime() - firstMonday.getTime()) / (7 * 86400000)
      ) + 1;
      if (micro < 1) micro = 1;
      
      const mesoNum = Math.floor((micro - 1) / 4) + 1;
      meso = `MESO ${mesoNum}`;
      
      const weekCollectives = list.filter((x: any) => 
        (x.session_type === "training" || x.session_type === "match") && 
        getMonday(x.date).getTime() === sessionMonday.getTime()
      );
      weekSeq = weekCollectives.findIndex((x: any) => x.id === s.id) + 1;
      if (weekSeq < 1) weekSeq = 1;
    }

    const validTags = ['MD-4', 'MD-3', 'MD-2', 'MD-1', 'MD', 'MD+1', 'MD+2'];
    const isMicroDayValid = s.microcycle_day && validTags.includes(s.microcycle_day);

    return {
      id: s.id,
      organization_id: s.organization_id,
      team_id: s.team_id,
      date: s.date,
      session_type: s.session_type,
      status: s.status,
      title: updatedTitle,
      microcycle_day: isMicroDayValid ? s.microcycle_day : null,
      mesocycle: meso,
      session_week_seq: weekSeq,
      session_total_seq: totalSeq,
    };
  });

  // Single bulk upsert — replaces N sequential UPDATE queries
  const { error: upsertError } = await supabase
    .from("training_sessions")
    .upsert(updates, { onConflict: "id" });

  if (upsertError) {
    logger.error("recalculateAndSaveSessionMetrics", { error: upsertError.message });
  }
}

/**
 * Obtiene todas las sesiones de la organización (opcionalmente filtrado por equipo).
 */
export async function getSessions(teamId?: string): Promise<TrainingSession[]> {
  const supabase = await createClient();
  let query = supabase
    .from("training_sessions")
    .select("*")
    .order("date", { ascending: false });

  if (teamId) {
    query = query.eq("team_id", teamId);
  }

  const { data, error } = await query;

  if (error) {
    logger.error("getSessions", { error: error.message });
    return [];
  }

  if (!data || data.length === 0) return [];

  return enrichSessionsWithMetrics(data);
}

/**
 * Obtiene el detalle de una sesión incluyendo ejercicios y asistencia.
 */
export async function getSessionById(id: string) {
  const supabase = await createClient();

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  let session: any = null;

  // 1. First try by UUID if valid UUID format
  if (isUuid) {
    const { data, error } = await supabase
      .from("training_sessions")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!error && data) {
      session = data;
    }
  }

  // 2. Fallback: If not found by UUID or if id is a date string (e.g. "2026-07-27", "27-07-2026", "27/7")
  if (!session) {
    let targetDate = id;
    if (id.includes("/") || id.includes("-")) {
      const cleanId = id.split("%2F").join("/").split("%2f").join("/");
      const parts = cleanId.split(/[\/-]/);
      if (parts.length === 2) {
        // e.g. "27/7" -> "2026-07-27"
        const day = parts[0].padStart(2, "0");
        const month = parts[1].padStart(2, "0");
        const year = new Date().getFullYear();
        targetDate = `${year}-${month}-${day}`;
      } else if (parts.length === 3) {
        if (parts[0].length === 4) {
          // YYYY-MM-DD
          targetDate = `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
        } else {
          // DD-MM-YYYY
          const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
          targetDate = `${year}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
        }
      }
    }

    const { data: dateSessions, error: dateError } = await supabase
      .from("training_sessions")
      .select("*")
      .eq("date", targetDate)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!dateError && dateSessions && dateSessions.length > 0) {
      session = dateSessions[0];
    }
  }

  if (!session) {
    logger.error("getSessionById", { error: `Session not found for identifier: ${id}` });
    return null;
  }

  const actualSessionId = session.id;

  // Load team sessions to compute metrics
  let matchedSession = session;
  if (session.team_id) {
    const { data: allSessions } = await supabase
      .from("training_sessions")
      .select("id, date, team_id, session_type")
      .eq("team_id", session.team_id) as any;
    if (allSessions && allSessions.length > 0) {
      if (!allSessions.some((s: any) => s.id === session.id)) {
        allSessions.push(session);
      }
      enrichSessionsWithMetrics(allSessions);
      const found = allSessions.find((s: any) => s.id === session.id);
      if (found) {
        matchedSession = {
          ...session,
          metrics: found.metrics,
          microcycle_day: found.microcycle_day
        };
      }
    }
  }

  if (!matchedSession.metrics) {
    matchedSession.metrics = {
      meso: "N/D",
      micro: 1,
      orden_semana: 1,
      total_sesiones: 1
    };
  }

  // 2. Cargar los ejercicios vinculados usando actualSessionId
  const { data: exercises, error: exercisesError } = await supabase
    .from("session_exercises")
    .select(`
      *,
      exercise:exercises(*)
    `)
    .eq("session_id", actualSessionId)
    .order("order_index", { ascending: true });

  if (exercisesError) {
    logger.error("getSessionById", { error: exercisesError.message });
  }

  // 3. Cargar la asistencia registrada usando actualSessionId
  const { data: attendance, error: attendanceError } = await supabase
    .from("session_attendance")
    .select(`
      *,
      player:players(
        id, 
        first_name, 
        last_name, 
        avatar_url,
        membership:player_team_memberships(
          id, jersey_number, positions, status, joined_date,
          team_id, season_id
        ),
        active_injury:injuries(
          id, status, body_part, severity
        )
      )
    `)
    .eq("session_id", actualSessionId);

  if (attendanceError) {
    logger.error("getSessionById", { error: attendanceError.message });
  }

  const mappedAttendance = (attendance ?? []).map((att: any) => {
    let playerObj = Array.isArray(att.player) ? att.player[0] : att.player;
    if (playerObj) {
      playerObj = {
        ...playerObj,
        membership: Array.isArray(playerObj.membership) ? playerObj.membership[0] : playerObj.membership,
        active_injury: Array.isArray(playerObj.active_injury) ? playerObj.active_injury[0] : playerObj.active_injury,
      };
    }
    return {
      ...att,
      player: playerObj,
    };
  });

  return {
    ...matchedSession,
    exercises: exercises ?? [],
    attendance: mappedAttendance,
  };
}

/**
 * Crea una nueva sesión de entrenamiento junto con su asistencia y ejercicios asociados.
 */
export async function createSession(
  organizationId: string,
  createdByUserId: string,
  input: CreateSessionInput
): Promise<string> {
  const supabase = await createClient();

  // 1. Insertar la sesión base
  const { data: session, error: sessionError } = await supabase
    .from("training_sessions")
    .insert({
      organization_id: organizationId,
      created_by: createdByUserId,
      team_id: input.team_id,
      season_id: input.season_id || null,
      title: input.title,
      date: input.date,
      duration_min: input.duration_min,
      session_type: input.session_type,
      microcycle_day: input.microcycle_day || null,
      planned_load: input.planned_load || null,
      planned_intensity: input.planned_intensity || null,
      objectives: input.objectives || [],
      tactical_concepts: input.tactical_concepts || [],
      muscle_groups: input.muscle_groups || [],
      notes: input.notes || null,
      template_id: input.template_id || null,
      status: input.status || "planned",
      match_game_plan: input.match_game_plan || null,
      start_time: input.start_time || "19:30:00",
      checkin_hours_before: input.checkin_hours_before ?? 8,
      checkin_close_mins_before: input.checkin_close_mins_before ?? 15,
      checkout_mins_after: input.checkout_mins_after ?? 30,
      checkout_close_hours_after: input.checkout_close_hours_after ?? 16,
      mesocycle: input.mesocycle || null,
      session_week_seq: input.session_week_seq || null,
      session_total_seq: input.session_total_seq || null,
      facility_ids: input.facility_ids || '{}',
    })
    .select("id")
    .single();

  if (sessionError) {
    logger.error("createSession", { error: sessionError.message });
    throw new Error(sessionError.message);
  }

  const sessionId = session.id;

  // 2. Insertar asistencia
  if (input.attendance && input.attendance.length > 0) {
    const attendanceData = input.attendance.map((att) => ({
      organization_id: organizationId,
      session_id: sessionId,
      player_id: att.player_id,
      status: att.status,
      notes: att.notes || null,
    }));

    const { error: attError } = await supabase
      .from("session_attendance")
      .insert(attendanceData);

    if (attError) {
      logger.error("createSession", { error: attError.message });
      throw new Error(attError.message);
    }
  }

  // 3. Insertar ejercicios asociados
  if (input.exercises && input.exercises.length > 0) {
    const exercisesData = input.exercises.map((ex) => ({
      organization_id: organizationId,
      session_id: sessionId,
      exercise_id: ex.exercise_id,
      order_index: ex.order_index,
      duration_min: ex.duration_min,
      recovery_min: ex.recovery_min,
      pitch_zones: ex.pitch_zones || [],
      equipment: ex.equipment || [],
      group_setup: ex.group_setup || {},
      whiteboard_data: ex.whiteboard_data || null,
      whiteboard_zone: ex.whiteboard_zone || null,
      space_dimensions: ex.space_dimensions || null,
      tactical_concepts: ex.tactical_concepts || [],
      muscle_groups: ex.muscle_groups || [],
    }));

    const { error: exError } = await supabase
      .from("session_exercises")
      .insert(exercisesData);

    if (exError) {
      logger.error("createSession", { error: exError.message });
      throw new Error(exError.message);
    }
  }

  // Recalculate metrics for all sessions of this team
  await recalculateAndSaveSessionMetrics(input.team_id, supabase);

  return sessionId;
}

/**
 * Actualiza una sesión existente, limpiando e insertando de nuevo asistencia y ejercicios.
 */
export async function updateSession(
  sessionId: string,
  organizationId: string,
  input: Omit<CreateSessionInput, "team_id" | "season_id"> & { status?: string }
): Promise<boolean> {
  const supabase = await createClient();

  // 1. Actualizar campos base
  const { error: sessionError } = await supabase
    .from("training_sessions")
    .update({
      title: input.title,
      date: input.date,
      duration_min: input.duration_min,
      session_type: input.session_type,
      microcycle_day: input.microcycle_day || null,
      planned_load: input.planned_load || null,
      planned_intensity: input.planned_intensity || null,
      objectives: input.objectives || [],
      tactical_concepts: input.tactical_concepts || [],
      muscle_groups: input.muscle_groups || [],
      notes: input.notes || null,
      template_id: input.template_id || null,
      status: input.status || "planned",
      match_game_plan: input.match_game_plan || null,
      start_time: input.start_time || "19:30:00",
      checkin_hours_before: input.checkin_hours_before ?? 8,
      checkin_close_mins_before: input.checkin_close_mins_before ?? 15,
      checkout_mins_after: input.checkout_mins_after ?? 30,
      checkout_close_hours_after: input.checkout_close_hours_after ?? 16,
      mesocycle: input.mesocycle || null,
      session_week_seq: input.session_week_seq || null,
      session_total_seq: input.session_total_seq || null,
      facility_ids: input.facility_ids || '{}',
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (sessionError) {
    logger.error("updateSession", { error: sessionError.message });
    throw new Error(sessionError.message);
  }

  // 2. Actualizar asistencia (Eliminar y volver a insertar)
  const { error: delAttError } = await supabase
    .from("session_attendance")
    .delete()
    .eq("session_id", sessionId);

  if (delAttError) {
    logger.error("updateSession", { error: delAttError.message });
    throw new Error(delAttError.message);
  }

  if (input.attendance && input.attendance.length > 0) {
    const attendanceData = input.attendance.map((att) => ({
      organization_id: organizationId,
      session_id: sessionId,
      player_id: att.player_id,
      status: att.status,
      notes: att.notes || null,
    }));

    const { error: attError } = await supabase
      .from("session_attendance")
      .insert(attendanceData);

    if (attError) {
      logger.error("updateSession", { error: attError.message });
      throw new Error(attError.message);
    }
  }

  // 3. Actualizar ejercicios (Eliminar y volver a insertar)
  const { error: delExError } = await supabase
    .from("session_exercises")
    .delete()
    .eq("session_id", sessionId);

  if (delExError) {
    logger.error("updateSession", { error: delExError.message });
    throw new Error(delExError.message);
  }

  if (input.exercises && input.exercises.length > 0) {
    const exercisesData = input.exercises.map((ex) => ({
      organization_id: organizationId,
      session_id: sessionId,
      exercise_id: ex.exercise_id,
      order_index: ex.order_index,
      duration_min: ex.duration_min,
      recovery_min: ex.recovery_min,
      pitch_zones: ex.pitch_zones || [],
      equipment: ex.equipment || [],
      group_setup: ex.group_setup || {},
      whiteboard_data: ex.whiteboard_data || null,
      whiteboard_zone: ex.whiteboard_zone || null,
      space_dimensions: ex.space_dimensions || null,
      tactical_concepts: ex.tactical_concepts || [],
      muscle_groups: ex.muscle_groups || [],
    }));

    const { error: exError } = await supabase
      .from("session_exercises")
      .insert(exercisesData);

    if (exError) {
      logger.error("updateSession", { error: exError.message });
      throw new Error(exError.message);
    }
  }

  // Get team_id of this session to trigger recalculate
  const { data: sessData } = await supabase
    .from("training_sessions")
    .select("team_id")
    .eq("id", sessionId)
    .single();
  if (sessData?.team_id) {
    await recalculateAndSaveSessionMetrics(sessData.team_id, supabase);
  }

  return true;
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  const supabase = await createClient();

  // Get team_id first to trigger recalculate after deletion
  const { data: sessData } = await supabase
    .from("training_sessions")
    .select("team_id")
    .eq("id", sessionId)
    .single();

  const { error } = await supabase
    .from("training_sessions")
    .delete()
    .eq("id", sessionId);

  if (error) {
    logger.error("deleteSession", { error: error.message });
    throw new Error(error.message);
  }

  if (sessData?.team_id) {
    await recalculateAndSaveSessionMetrics(sessData.team_id, supabase);
  }

  return true;
}
