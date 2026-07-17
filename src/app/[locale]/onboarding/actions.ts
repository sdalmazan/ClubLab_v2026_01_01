'use server';

import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Server Action: Creates the initial free subscription for a new organization.
 * Uses the service_role admin client to bypass RLS — this is intentional since
 * the user doesn't have a role yet at the time of subscription creation.
 *
 * This is the ONLY place where subscriptions can be created from user-facing code.
 * Paid plan upgrades must go through the Stripe webhook.
 */
export async function createInitialSubscription(
  organizationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabaseAdmin = createAdminClient();

    // Fetch the free plan ID
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