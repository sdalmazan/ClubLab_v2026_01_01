/**
 * ClubLab v2026.01.01 — Physical Tests Service
 * Multi-tenant data access layer for physical tests.
 */

import { createClient } from "@/lib/supabase/server";
import type { PhysicalTest, PhysicalTestResult } from "@/types";

export interface PerformanceTestInput {
  player_id: string;
  test_id: string;
  date: string;
  value: number;
  notes?: string | null;
  conducted_by?: string | null;
}

/**
 * Obtiene todos los tipos de test activos para la organización del usuario.
 */
export async function getTestTypes(): Promise<PhysicalTest[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("physical_tests")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    console.error("[getTestTypes]", error.message);
    return [];
  }

  return data ?? [];
}

/**
 * Obtiene los resultados de tests físicos de un jugador con un límite opcional.
 */
export async function getPerformanceTestsByPlayerId(
  playerId: string,
  limit?: number
): Promise<PhysicalTestResult[]> {
  const supabase = await createClient();

  let query = supabase
    .from("physical_test_results")
    .select(`
      *,
      physical_tests:physical_tests(
        id,
        name,
        description,
        unit,
        category,
        higher_is_better
      )
    `)
    .eq("player_id", playerId)
    .order("date", { ascending: false });

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[getPerformanceTestsByPlayerId]", error.message);
    return [];
  }

  return (data as any) ?? [];
}

/**
 * Inserta un nuevo resultado de test físico.
 */
export async function insertPerformanceTest(
  organizationId: string,
  teamId: string | null,
  input: PerformanceTestInput
) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("physical_test_results")
    .insert({
      organization_id: organizationId,
      team_id: teamId,
      player_id: input.player_id,
      test_id: input.test_id,
      date: input.date,
      value: input.value,
      notes: input.notes || null,
      conducted_by: input.conducted_by || null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Elimina un resultado de test físico.
 */
export async function deletePerformanceTest(testId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("physical_test_results")
    .delete()
    .eq("id", testId);

  if (error) throw new Error(error.message);
  return true;
}
