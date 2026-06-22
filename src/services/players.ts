/**
 * ClubLab v2026.01.01 — Players Service
 * Multi-tenant data access layer for players.
 * All queries are organisation-scoped (RLS also enforces this at DB level).
 */

import { createClient } from "@/lib/supabase/server";
import type { Player, PlayerTeamMembership, PositionKey } from "@/types";

// ============================================================
// TYPES
// ============================================================

export interface PlayerWithMembership extends Player {
  membership?: PlayerTeamMembership & {
    teams?: { name: string; id: string } | null;
  };
  latest_wellness?: {
    fatigue: number | null;
    sleep_quality: number | null;
    mood: number | null;
    localized_discomfort: string | null;
  } | null;
  active_injury?: {
    id: string;
    status: string;
    body_part: string;
    severity: string;
  } | null;
}

export interface CreatePlayerInput {
  first_name: string;
  last_name: string;
  date_of_birth?: string | null;
  nationality?: string | null;
  dominant_foot?: "right" | "left" | "both" | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  avatar_url?: string | null;
  // Membership
  team_id: string;
  season_id: string;
  jersey_number?: number | null;
  positions?: PositionKey[];
}

export interface UpdatePlayerInput {
  first_name?: string;
  last_name?: string;
  date_of_birth?: string | null;
  nationality?: string | null;
  dominant_foot?: "right" | "left" | "both" | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  avatar_url?: string | null;
}

// ============================================================
// QUERIES
// ============================================================

/**
 * Get all players in the current organisation with their
 * active team membership, latest wellness and injury status.
 */
export async function getSquadPlayers(teamId?: string): Promise<PlayerWithMembership[]> {
  const supabase = await createClient();

  let query = supabase
    .from("players")
    .select(`
      *,
      membership:player_team_memberships(
        id, jersey_number, positions, status, joined_date,
        team_id, season_id,
        teams:teams(id, name)
      ),
      active_injury:injuries(
        id, status, body_part, severity
      )
    `)
    .eq("player_team_memberships.status", "active")
    .in("injuries.status", ["active", "readaptation"])
    .order("last_name", { ascending: true });

  if (teamId) {
    query = query.eq("player_team_memberships.team_id", teamId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[getSquadPlayers]", error.message);
    return [];
  }

  return (data ?? []).map((p: any) => ({
    ...p,
    membership: Array.isArray(p.membership) ? p.membership[0] : p.membership,
    active_injury: Array.isArray(p.active_injury) ? p.active_injury[0] : p.active_injury,
  }));
}

/**
 * Get a single player by ID with full profile data.
 */
export async function getPlayerById(id: string): Promise<PlayerWithMembership | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("players")
    .select(`
      *,
      membership:player_team_memberships(
        id, jersey_number, positions, status, joined_date,
        team_id, season_id,
        teams:teams(id, name)
      ),
      active_injury:injuries(
        id, status, body_part, severity
      )
    `)
    .eq("id", id)
    .in("injuries.status", ["active", "readaptation"])
    .single();

  if (error) {
    console.error("[getPlayerById]", error.message);
    return null;
  }

  return {
    ...data,
    membership: Array.isArray(data.membership) ? data.membership[0] : data.membership,
    active_injury: Array.isArray(data.active_injury) ? data.active_injury[0] : data.active_injury,
  } as PlayerWithMembership;
}

/**
 * Create a new player and their initial team membership.
 */
export async function createPlayer(
  organizationId: string,
  input: CreatePlayerInput
): Promise<{ player: Player | null; error: string | null }> {
  const supabase = await createClient();

  const { data: player, error: playerError } = await supabase
    .from("players")
    .insert({
      organization_id: organizationId,
      first_name: input.first_name,
      last_name: input.last_name,
      date_of_birth: input.date_of_birth,
      nationality: input.nationality,
      dominant_foot: input.dominant_foot,
      height_cm: input.height_cm,
      weight_kg: input.weight_kg,
      avatar_url: input.avatar_url,
    })
    .select()
    .single();

  if (playerError) return { player: null, error: playerError.message };

  const { error: membershipError } = await supabase
    .from("player_team_memberships")
    .insert({
      player_id: player.id,
      team_id: input.team_id,
      season_id: input.season_id,
      jersey_number: input.jersey_number,
      positions: input.positions ?? [],
      status: "active",
      joined_date: new Date().toISOString().split("T")[0],
    });

  if (membershipError) return { player, error: membershipError.message };

  return { player, error: null };
}

/**
 * Update player profile fields.
 */
export async function updatePlayer(
  id: string,
  input: UpdatePlayerInput
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("players")
    .update(input)
    .eq("id", id);

  return { error: error?.message ?? null };
}

/**
 * Get all teams in the current org (for selects).
 */
export async function getOrgTeams() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("teams")
    .select("id, name, category, season_id, seasons(name, is_active)")
    .order("name");
  return data ?? [];
}

/**
 * Get the active season for a club.
 */
export async function getActiveSeason(clubId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("seasons")
    .select("id, name")
    .eq("club_id", clubId)
    .eq("is_active", true)
    .single();
  return data;
}
