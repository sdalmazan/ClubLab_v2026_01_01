/**
 * ClubLab v2026.01.01 — Tasks & Exercises Service
 * Multi-tenant data access layer for player tasks.
 */

import { createClient } from "@/lib/supabase/server";
import type { PlayerTask } from "@/types";
import { logger } from '@/lib/logger';

export interface ExerciseLibraryItem {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  difficulty: string | null;
  library_scope?: string | null;
  tactical_concepts?: string[];
  muscle_groups?: string[];
  // Group / team config
  needs_groups?: boolean;
  num_groups?: number;
  players_per_group?: string | null;
  // Media (strength exercises)
  image_url?: string | null;
  video_url?: string | null;
  // Whiteboard
  whiteboard_data?: any;
  whiteboard_zone?: string | null;
  space_dimensions?: string | null;
}

/**
 * Obtiene la biblioteca completa de ejercicios de la organización.
 */
export async function getTaskLibrary(orgId?: string, userId?: string): Promise<ExerciseLibraryItem[]> {
  const supabase = await createClient();

  let { data, error } = await supabase
    .from("exercises")
    .select("id, title, description, category, difficulty, library_scope, tactical_concepts, muscle_groups, needs_groups, num_groups, players_per_group, image_url, video_url, whiteboard_data, whiteboard_zone, space_dimensions")
    .order("title", { ascending: true });

  if (error) {
    logger.error("getTaskLibrary", { error: error.message });
    return [];
  }

  // Si la biblioteca está vacía y se provee organización, sembramos por defecto y volvemos a cargar
  if ((!data || data.length === 0) && orgId) {
    console.log(`🌱 Sembrando ejercicios por defecto para la organización ${orgId}...`);
    const { error: seedError } = await supabase.rpc("seed_default_exercises", {
      org_id: orgId,
      user_id: userId || null,
    });

    if (!seedError) {
      const { data: refetched, error: refetchError } = await supabase
        .from("exercises")
        .select("id, title, description, category, difficulty, library_scope, tactical_concepts, muscle_groups, needs_groups, num_groups, players_per_group, image_url, video_url, whiteboard_data, whiteboard_zone, space_dimensions")
        .order("title", { ascending: true });
      if (!refetchError && refetched) {
        data = refetched;
      }
    } else {
      logger.error("getTaskLibrary", { error: seedError.message });
    }
  }

  return data ?? [];
}

/**
 * Asigna un ejercicio de la biblioteca a un jugador.
 */
export async function assignTaskToPlayer(
  organizationId: string,
  playerId: string,
  exerciseId: string,
  staffComment?: string | null
) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("player_tasks")
    .insert({
      organization_id: organizationId,
      player_id: playerId,
      exercise_id: exerciseId,
      status: "assigned",
      staff_comment: staffComment || null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Quita una tarea asignada a un jugador.
 */
export async function deletePlayerTask(playerTaskId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("player_tasks")
    .delete()
    .eq("id", playerTaskId);

  if (error) throw new Error(error.message);
  return true;
}

/**
 * Obtiene las tareas individuales asignadas a un jugador.
 */
export async function getPlayerTasks(playerId: string): Promise<any[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("player_tasks")
    .select(`
      id,
      status,
      staff_comment,
      created_at,
      exercise:exercises(
        id,
        title,
        description,
        category,
        difficulty
      )
    `)
    .eq("player_id", playerId)
    .order("created_at", { ascending: false });

  if (error) {
    logger.error("getPlayerTasks", { error: error.message });
    return [];
  }

  return data ?? [];
}
