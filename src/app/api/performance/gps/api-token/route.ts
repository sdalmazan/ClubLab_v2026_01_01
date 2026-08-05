import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET  /api/performance/gps/api-token
 * POST /api/performance/gps/api-token
 *
 * Manages organization API tokens for the local WIMU GPS agent.
 * Uses admin client + user auth to scope tokens by organization.
 */

import { createClient as createServerClient } from "@/lib/supabase/server";

async function getOrgId(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("user_organization_roles")
    .select("organization_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.organization_id ?? null;
}

export async function GET() {
  try {
    const serverClient = await createServerClient();
    const { data: { user } } = await serverClient.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });

    const orgId = await getOrgId(serverClient, user.id);
    if (!orgId) return NextResponse.json({ success: false, error: "Organización no encontrada" }, { status: 404 });

    const supabase = createAdminClient();
    const { data: tokenRecord } = await supabase
      .from("organization_api_tokens")
      .select("id, token, label, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!tokenRecord) {
      return NextResponse.json({ success: true, token: null, masked: null });
    }

    // Return masked token: show prefix + last 4 chars
    const raw = tokenRecord.token as string;
    const masked = raw.length > 12
      ? raw.slice(0, 14) + "·".repeat(raw.length - 18) + raw.slice(-4)
      : raw.slice(0, 4) + "···";

    return NextResponse.json({
      success: true,
      tokenId: tokenRecord.id,
      masked,
      createdAt: tokenRecord.created_at,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const serverClient = await createServerClient();
    const { data: { user } } = await serverClient.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });

    const orgId = await getOrgId(serverClient, user.id);
    if (!orgId) return NextResponse.json({ success: false, error: "Organización no encontrada" }, { status: 404 });

    const supabase = createAdminClient();

    // Delete old tokens for this org
    await supabase
      .from("organization_api_tokens")
      .delete()
      .eq("organization_id", orgId);

    // Generate new cryptographically random token
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
    const token = `clg_live_${hex}`;

    const { error: insertErr } = await supabase
      .from("organization_api_tokens")
      .insert({
        organization_id: orgId,
        token,
        label: "Agente GPS Local",
      });

    if (insertErr) throw insertErr;

    return NextResponse.json({
      success: true,
      token, // Full token — only returned ONCE at creation
      message: "Token generado. Guárdalo en tu wimu_config.json. No se mostrará de nuevo.",
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const serverClient = await createServerClient();
    const { data: { user } } = await serverClient.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });

    const orgId = await getOrgId(serverClient, user.id);
    if (!orgId) return NextResponse.json({ success: false, error: "Organización no encontrada" }, { status: 404 });

    const supabase = createAdminClient();
    await supabase
      .from("organization_api_tokens")
      .delete()
      .eq("organization_id", orgId);

    return NextResponse.json({ success: true, message: "Token revocado." });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
