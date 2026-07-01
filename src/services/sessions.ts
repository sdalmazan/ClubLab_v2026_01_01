/**
 * ClubLab v2026.01.01 — Sessions Service
 * Multi-tenant data access layer for training sessions, attendance, and session exercises.
 */

import { createClient } from "@/lib/supabase/server";
import type { TrainingSession } from "@/types";

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
    console.error("[getSessions]", error.message);
    return [];
  }

  return data ?? [];
}

/**
 * Obtiene el detalle de una sesión incluyendo ejercicios y asistencia.
 */
export async function getSessionById(id: string) {
  const supabase = await createClient();

  // 1. Cargar datos básicos de la sesión
  const { data: session, error: sessionError } = await supabase
    .from("training_sessions")
    .select("*")
    .eq("id", id)
    .single();

  if (sessionError) {
    console.error("[getSessionById] Session error:", sessionError.message);
    return null;
  }

  // 2. Cargar los ejercicios vinculados
  const { data: exercises, error: exercisesError } = await supabase
    .from("session_exercises")
    .select(`
      *,
      exercise:exercises(*)
    `)
    .eq("session_id", id)
    .order("order_index", { ascending: true });

  if (exercisesError) {
    console.error("[getSessionById] Exercises error:", exercisesError.message);
  }

  // 3. Cargar la asistencia registrada
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
    .eq("session_id", id);

  if (attendanceError) {
    console.error("[getSessionById] Attendance error:", attendanceError.message);
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
    ...session,
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
      notes: input.notes || null,
      template_id: input.template_id || null,
      status: input.status || "planned",
      match_game_plan: input.match_game_plan || null,
      start_time: input.start_time || "10:00:00",
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
    console.error("[createSession] Session insert failed:", sessionError.message);
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
      console.error("[createSession] Attendance insert failed:", attError.message);
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
      console.error("[createSession] Exercises insert failed:", exError.message);
      throw new Error(exError.message);
    }
  }

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
      notes: input.notes || null,
      template_id: input.template_id || null,
      status: input.status || "planned",
      match_game_plan: input.match_game_plan || null,
      start_time: input.start_time || "10:00:00",
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
    console.error("[updateSession] Base update failed:", sessionError.message);
    throw new Error(sessionError.message);
  }

  // 2. Actualizar asistencia (Eliminar y volver a insertar)
  const { error: delAttError } = await supabase
    .from("session_attendance")
    .delete()
    .eq("session_id", sessionId);

  if (delAttError) {
    console.error("[updateSession] Attendance delete failed:", delAttError.message);
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
      console.error("[updateSession] Attendance insert failed:", attError.message);
      throw new Error(attError.message);
    }
  }

  // 3. Actualizar ejercicios (Eliminar y volver a insertar)
  const { error: delExError } = await supabase
    .from("session_exercises")
    .delete()
    .eq("session_id", sessionId);

  if (delExError) {
    console.error("[updateSession] Exercises delete failed:", delExError.message);
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
      console.error("[updateSession] Exercises insert failed:", exError.message);
      throw new Error(exError.message);
    }
  }

  return true;
}

/**
 * Elimina una sesión de entrenamiento (las cascadas eliminan asistencia y ejercicios vinculados).
 */
export async function deleteSession(sessionId: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("training_sessions")
    .delete()
    .eq("id", sessionId);

  if (error) {
    console.error("[deleteSession] Failed:", error.message);
    throw new Error(error.message);
  }

  return true;
}
