/**
 * ClubLab v2026.01.01 — Templates Service
 * Multi-tenant data access layer for session templates.
 */

import { createClient } from "@/lib/supabase/server";
import type { SessionTemplate } from "@/types";
import { logger } from '@/lib/logger';

export interface CreateTemplateInput {
  title: string;
  description?: string | null;
  duration_min?: number | null;
  session_type: string;
  objectives?: string[];
  is_shared?: boolean;
  library_scope?: string | null;
  microcycle_day?: string | null;
  exercises: Array<{
    exercise_id: string;
    order_index: number;
    duration_min: number;
    recovery_min: number;
    pitch_zones: string[];
    equipment: Array<{ name: string; quantity: number }>;
    group_setup: {
      groups?: Array<{ name: string }>;
    };
    whiteboard_data?: any | null;
    whiteboard_zone?: string | null;
    space_dimensions?: string | null;
    tactical_concepts?: string[];
    muscle_groups?: string[];
  }>;
}

/**
 * Obtiene todas las plantillas de sesión de la organización.
 */
export async function getSessionTemplates(): Promise<SessionTemplate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("session_templates")
    .select(`
      *,
      exercises:template_exercises(
        *,
        exercise:exercises(*)
      )
    `)
    .order("title", { ascending: true });

  if (error) {
    logger.error("getSessionTemplates", { error: error.message });
    return [];
  }

  return data ?? [];
}

/**
 * Obtiene una plantilla de sesión con sus ejercicios estructurados.
 */
export async function getTemplateById(id: string) {
  const supabase = await createClient();

  // 1. Obtener la plantilla base
  const { data: template, error: templateError } = await supabase
    .from("session_templates")
    .select("*")
    .eq("id", id)
    .single();

  if (templateError) {
    logger.error("getTemplateById", { error: templateError.message });
    return null;
  }

  // 2. Obtener los ejercicios estructurados
  const { data: exercises, error: exercisesError } = await supabase
    .from("template_exercises")
    .select(`
      *,
      exercise:exercises(*)
    `)
    .eq("template_id", id)
    .order("order_index", { ascending: true });

  if (exercisesError) {
    logger.error("getTemplateById", { error: exercisesError.message });
  }

  return {
    ...template,
    exercises: exercises ?? [],
  };
}

/**
 * Crea una plantilla de sesión.
 */
export async function createSessionTemplate(
  organizationId: string,
  createdByUserId: string,
  input: CreateTemplateInput
): Promise<string> {
  const supabase = await createClient();

  // 1. Insertar la plantilla
  const { data: template, error: templateError } = await supabase
    .from("session_templates")
    .insert({
      organization_id: organizationId,
      created_by: createdByUserId,
      title: input.title,
      description: input.description || null,
      duration_min: input.duration_min || null,
      session_type: input.session_type,
      objectives: input.objectives || [],
      is_shared: input.is_shared || false,
      library_scope: input.library_scope || "coach",
      microcycle_day: input.microcycle_day || null,
    })
    .select("id")
    .single();

  if (templateError) {
    logger.error("createSessionTemplate", { error: templateError.message });
    throw new Error(templateError.message);
  }

  const templateId = template.id;

  // 2. Insertar ejercicios asociados
  if (input.exercises && input.exercises.length > 0) {
    const exercisesData = input.exercises.map((ex) => ({
      organization_id: organizationId,
      template_id: templateId,
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
      .from("template_exercises")
      .insert(exercisesData);

    if (exError) {
      logger.error("createSessionTemplate", { error: exError.message });
      throw new Error(exError.message);
    }
  }

  return templateId;
}

/**
 * Actualiza una plantilla de sesión existente y sus ejercicios asociados.
 */
export async function updateSessionTemplate(
  templateId: string,
  organizationId: string,
  input: CreateTemplateInput
): Promise<boolean> {
  const supabase = await createClient();

  // 1. Actualizar la plantilla base
  const { error: templateError } = await supabase
    .from("session_templates")
    .update({
      title: input.title,
      description: input.description || null,
      duration_min: input.duration_min || null,
      session_type: input.session_type,
      objectives: input.objectives || [],
      is_shared: input.is_shared || false,
      library_scope: input.library_scope || "coach",
      microcycle_day: input.microcycle_day || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", templateId);

  if (templateError) {
    logger.error("updateSessionTemplate", { error: templateError.message });
    throw new Error(templateError.message);
  }

  // 2. Eliminar ejercicios asociados
  const { error: delError } = await supabase
    .from("template_exercises")
    .delete()
    .eq("template_id", templateId);

  if (delError) {
    logger.error("updateSessionTemplate", { error: delError.message });
    throw new Error(delError.message);
  }

  // 3. Volver a insertar ejercicios estructurados
  if (input.exercises && input.exercises.length > 0) {
    const exercisesData = input.exercises.map((ex) => ({
      organization_id: organizationId,
      template_id: templateId,
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
      .from("template_exercises")
      .insert(exercisesData);

    if (exError) {
      logger.error("updateSessionTemplate", { error: exError.message });
      throw new Error(exError.message);
    }
  }

  return true;
}

/**
 * Elimina una plantilla de sesión (las cascadas borran la relación template_exercises).
 */
export async function deleteSessionTemplate(templateId: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("session_templates")
    .delete()
    .eq("id", templateId);

  if (error) {
    logger.error("deleteSessionTemplate", { error: error.message });
    throw new Error(error.message);
  }

  return true;
}
