'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Server Action: Creates the initial free subscription for a new organization.
 */
export async function createInitialSubscription(
  organizationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabaseAdmin = createAdminClient();

    const { data: freePlan, error: planErr } = await supabaseAdmin
      .from('plans')
      .select('id')
      .eq('slug', 'free')
      .single();

    if (planErr || !freePlan) {
      return { success: false, error: 'Plan gratuito no encontrado' };
    }

    const { error: subErr } = await supabaseAdmin
      .from('subscriptions')
      .insert({
        organization_id: organizationId,
        plan_id: freePlan.id,
        status: 'manual',
      });

    if (subErr) {
      return { success: false, error: subErr.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error inesperado' };
  }
}

/**
 * Server Action: Checks if the user is already assigned/invited to an organization.
 * Used for pre-filling player onboarding (e.g. S.D. Almazán invites).
 */
export async function checkUserOnboardingStatusAction(): Promise<{
  alreadyAssigned: boolean;
  orgName?: string;
  role?: string;
  token?: string;
}> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { alreadyAssigned: false };
    }

    const adminSupabase = createAdminClient();

    // 1. Check user_organization_roles
    const { data: orgRole } = await adminSupabase
      .from("user_organization_roles")
      .select("role, organization_id, organizations(name)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (orgRole && orgRole.organization_id) {
      const orgName = (orgRole as any).organizations?.name || "tu club";
      return {
        alreadyAssigned: true,
        orgName,
        role: orgRole.role || "player",
      };
    }

    // 2. Check player_invitations or players table by user email
    if (user.email) {
      const { data: inv } = await adminSupabase
        .from("player_invitations")
        .select("*, organizations(name)")
        .ilike("email", user.email.trim())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (inv && inv.organization_id) {
        const orgName = (inv as any).organizations?.name || "S.D. Almazán";

        // Assign user_organization_role using admin client
        await adminSupabase.from("user_organization_roles").upsert(
          {
            user_id: user.id,
            organization_id: inv.organization_id,
            role: inv.role || "player",
          },
          { onConflict: "user_id,organization_id" }
        );

        // Mark invitation accepted
        await adminSupabase
          .from("player_invitations")
          .update({ status: "accepted", accepted_at: new Date().toISOString() })
          .eq("id", inv.id);

        return {
          alreadyAssigned: true,
          orgName,
          role: inv.role || "player",
        };
      }

      // Check players table
      const { data: playerRec } = await adminSupabase
        .from("players")
        .select("organization_id, organizations(name)")
        .ilike("email", user.email.trim())
        .limit(1)
        .maybeSingle();

      if (playerRec && playerRec.organization_id) {
        const orgName = (playerRec as any).organizations?.name || "S.D. Almazán";

        await adminSupabase.from("user_organization_roles").upsert(
          {
            user_id: user.id,
            organization_id: playerRec.organization_id,
            role: "player",
          },
          { onConflict: "user_id,organization_id" }
        );

        return {
          alreadyAssigned: true,
          orgName,
          role: "player",
        };
      }
    }

    return { alreadyAssigned: false };
  } catch (err) {
    console.error("[checkUserOnboardingStatusAction Error]", err);
    return { alreadyAssigned: false };
  }
}

export interface CompleteOnboardingInput {
  orgType: "club" | "academy" | "independent_coach";
  orgName: string;
  clubName: string;
  seasonName: string;
  teamName: string;
  role: string;
  playerData?: {
    dob?: string;
    nationality?: string;
    dominantFoot?: "right" | "left" | "both";
    heightCm?: string;
    weightKg?: string;
    position?: string;
  };
}

/**
 * Server Action: Complete full onboarding for a new organization.
 * Uses service_role client to bypass RLS policies on organizations table.
 */
export async function completeOnboardingAction(input: CompleteOnboardingInput): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Usuario no autenticado." };
    }

    const adminSupabase = createAdminClient();

    // Check if user already has an org role
    const { data: existingRole } = await adminSupabase
      .from("user_organization_roles")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (existingRole) {
      return { success: true };
    }

    const fullName = user.user_metadata?.full_name || "Miembro";
    const finalOrgName = input.orgName.trim() || `${fullName} Space`;
    const slug = `${slugify(finalOrgName)}-${Date.now().toString().slice(-4)}`;

    // 1. Create Organization via Admin Client (bypasses RLS error)
    const { data: org, error: orgErr } = await adminSupabase
      .from("organizations")
      .insert({
        name: finalOrgName,
        slug: slug,
        type: input.orgType,
      })
      .select("id")
      .single();

    if (orgErr || !org) {
      return { success: false, error: `Error creando organización: ${orgErr?.message}` };
    }

    // 2. Initial free plan subscription
    await createInitialSubscription(org.id);

    // 3. User organization role
    const finalRole = input.role === "player" ? "player" : input.role === "head_coach" ? "head_coach" : "club_admin";
    await adminSupabase.from("user_organization_roles").insert({
      user_id: user.id,
      organization_id: org.id,
      role: finalRole,
    });

    // 4. Create club
    const { data: club, error: clubErr } = await adminSupabase
      .from("clubs")
      .insert({
        organization_id: org.id,
        name: input.clubName.trim() || finalOrgName,
      })
      .select("id")
      .single();

    if (clubErr || !club) {
      return { success: false, error: `Error creando club: ${clubErr?.message}` };
    }

    // 5. Create season
    const { data: season, error: seasonErr } = await adminSupabase
      .from("seasons")
      .insert({
        club_id: club.id,
        name: input.seasonName || "2026/27",
        start_date: "2026-07-01",
        end_date: "2027-06-30",
        is_active: true,
      })
      .select("id")
      .single();

    if (seasonErr || !season) {
      return { success: false, error: `Error creando temporada: ${seasonErr?.message}` };
    }

    // 6. Create team
    const { data: team, error: teamErr } = await adminSupabase
      .from("teams")
      .insert({
        club_id: club.id,
        season_id: season.id,
        name: input.teamName || "Primer equipo",
        category: "Senior",
      })
      .select("id")
      .single();

    if (teamErr || !team) {
      return { success: false, error: `Error creando equipo: ${teamErr?.message}` };
    }

    // 7. Seed player record if role is player
    if (input.role === "player" && input.playerData) {
      const nameParts = fullName.trim().split(" ");
      const firstName = nameParts[0] || "Jugador";
      const lastName = nameParts.slice(1).join(" ") || "Individual";

      const { data: playerRecord } = await adminSupabase
        .from("players")
        .insert({
          organization_id: org.id,
          user_id: user.id,
          email: user.email,
          first_name: firstName,
          last_name: lastName,
          date_of_birth: input.playerData.dob || null,
          nationality: input.playerData.nationality || "Española",
          dominant_foot: input.playerData.dominantFoot || "right",
          height_cm: input.playerData.heightCm ? parseFloat(input.playerData.heightCm) : null,
          weight_kg: input.playerData.weightKg ? parseFloat(input.playerData.weightKg) : null,
        })
        .select("id")
        .single();

      if (playerRecord) {
        await adminSupabase.from("player_team_memberships").insert({
          player_id: playerRecord.id,
          team_id: team.id,
          season_id: season.id,
          jersey_number: 10,
          positions: [input.playerData.position || "striker"],
          status: "active",
        });
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error("[completeOnboardingAction Error]", err);
    return { success: false, error: err.message || "Error al completar la configuración de la entidad." };
  }
}