/**
 * ClubLab v2026.01.01 — Players Service
 * Multi-tenant data access layer for players.
 * All queries are organisation-scoped (RLS also enforces this at DB level).
 */

import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import type { Player, PlayerTeamMembership, PositionKey, PlayerStatus, AvailabilityStatus } from "@/types";
import { logger } from '@/lib/logger';

// ============================================================
// TYPES
// ============================================================

export interface PlayerWithMembership extends Player {
  membership?: PlayerTeamMembership & {
    teams?: { name: string; id: string } | null;
    seasons?: { id: string; name: string; start_date: string } | null;
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
  adjective?: string | null;
  sporting_name?: string | null;
  signing_status?: "signed" | "close" | "difficult";
  player_type?: "main" | "reserve" | "youth" | "other";
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
  physical_status?: PlayerStatus;
  availability_status?: AvailabilityStatus;
  availability_notes?: string | null;
  adjective?: string | null;
  sporting_name?: string | null;
  signing_status?: "signed" | "close" | "difficult";
}

// ============================================================
// QUERIES
// ============================================================

/**
 * Get all players in the current organisation with their
 * active team membership, latest wellness and injury status.
 */
export async function getSquadPlayers(
  teamId?: string,
  strictTeamOnly: boolean = false,
  includeInvisible: boolean = false,
  includeInactive: boolean = false
): Promise<PlayerWithMembership[]> {
  const supabase = await createClient();

  let query = supabase
    .from("players")
    .select(`
      *,
      membership:player_team_memberships(
        id, jersey_number, positions, kicker_roles, status, joined_date, left_date,
        team_id, season_id, player_type, player_type_label,
        teams:teams(id, name),
        seasons:seasons(id, name, start_date)
      ),
      active_injury:injuries(
        id, status, body_part, severity
      )
    `)
    .order("last_name", { ascending: true });
  // Auto-enable includeInvisible ONLY if current user is super_admin and NO simulated role override is active
  if (!includeInvisible) {
    try {
      const cookieStore = await cookies();
      const roleOverride = cookieStore.get("cl_role_override")?.value;

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: orgRole } = await supabase
          .from("user_organization_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();

        const isSuperAdmin = orgRole?.role === "super_admin" || user.email === "diecilo7@gmail.com";
        // If a simulated role is active (e.g. head_coach), evaluate activeRole as that simulated role!
        const activeRole = isSuperAdmin && roleOverride && roleOverride !== "super_admin" ? roleOverride : orgRole?.role;

        if (activeRole === "super_admin") {
          includeInvisible = true;
        }
      }
    } catch (e) {}
  }

  if (!includeInvisible) {
    query = query.or("is_invisible.eq.false,is_invisible.is.null");
  }

  const { data, error } = await query;

  if (error) {
    logger.error("getSquadPlayers", { error: error.message });
    return [];
  }

  // Fetch active injuries from organization settings fallback to ensure complete sync
  const firstOrgId = data?.[0]?.organization_id;
  let settingsInjuries: any[] = [];
  if (firstOrgId) {
    const { data: org } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", firstOrgId)
      .single();
    settingsInjuries = org?.settings?.active_injuries || [];
  }

  const mappedPlayers = (data ?? [])
    .filter((p: any) => {
      if (!includeInvisible && (p.is_invisible === true || p.adjective === "invisible")) {
        return false;
      }
      const mem = Array.isArray(p.membership) ? p.membership[0] : p.membership;
      if (!includeInactive && mem && mem.status === "inactive") {
        return false;
      }
      return true;
    })
    .map((p: any) => {
      const dbInj = Array.isArray(p.active_injury) ? p.active_injury[0] : p.active_injury;
      const settingInj = settingsInjuries.find((i: any) => i.player_id === p.id && i.status !== "healed");
      const activeInj = dbInj || settingInj || null;

      let physStatus = p.physical_status || "green";
      let availStatus = p.availability_status || "available";
      let availNotes = p.availability_notes || null;

      if (activeInj) {
        const phase = activeInj.recovery_phase || 1;
        physStatus = phase === 4 ? "green" : phase === 3 ? "yellow" : "red";
        availStatus = phase === 4 ? "available" : "not_available";
        availNotes = phase === 4 ? null : `${activeInj.body_part || activeInj.injury_type || "Lesión"} (Fase ${phase})`;
      }

      return {
        ...p,
        membership: Array.isArray(p.membership) ? p.membership[0] : p.membership,
        active_injury: activeInj,
        physical_status: physStatus,
        availability_status: availStatus,
        availability_notes: availNotes,
      };
    });

  // Fetch today's wellness and rpe entries to attach latest_wellness and latest_rpe
  const todayStr = new Date().toISOString().split("T")[0];
  const { data: todayWellness } = await supabase
    .from("wellness_entries")
    .select("*")
    .eq("date", todayStr);

  const { data: todayCheckins } = await supabase
    .from("player_wellness_checkins")
    .select("*")
    .eq("date", todayStr);

  const { data: todayRpe } = await supabase
    .from("rpe_entries")
    .select("*")
    .eq("date", todayStr);

  const wellnessMap = new Map<string, any>();
  (todayWellness ?? []).forEach((w: any) => wellnessMap.set(w.player_id, w));
  (todayCheckins ?? []).forEach((c: any) => {
    if (!wellnessMap.has(c.player_id)) {
      wellnessMap.set(c.player_id, c);
    }
  });

  const rpeMap = new Map<string, any>();
  (todayRpe ?? []).forEach((r: any) => rpeMap.set(r.player_id, r));

  const playersWithWellnessAndRpe = mappedPlayers.map((p) => {
    const checkin = wellnessMap.get(p.id) || null;
    const effectiveWeight = checkin?.weight_kg ?? p.weight_kg ?? null;
    const finalWellness = checkin
      ? { ...checkin, weight_kg: checkin.weight_kg ?? p.weight_kg }
      : null;

    return {
      ...p,
      latest_wellness: finalWellness,
      latest_rpe: rpeMap.get(p.id) || null,
    };
  });

  if (teamId && strictTeamOnly) {
    return playersWithWellnessAndRpe.filter((p) => p.membership?.team_id === teamId);
  }

  // Return all squad players (main team + filial/juvenil/reserve)
  return playersWithWellnessAndRpe;
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
        id, jersey_number, positions, kicker_roles, status, joined_date,
        team_id, season_id, player_type, player_type_label,
        teams:teams(id, name),
        seasons:seasons(id, name, start_date)
      ),
      active_injury:injuries(
        id, status, body_part, severity
      )
    `)
    .eq("id", id)
    .in("injuries.status", ["active", "readaptation"])
    .single();

  if (error) {
    logger.error("getPlayerById", { error: error.message });
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
      adjective: input.adjective,
      sporting_name: input.sporting_name,
      signing_status: input.signing_status || "signed",
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
      player_type: input.player_type || "main",
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
    .order("created_at", { ascending: true });
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
