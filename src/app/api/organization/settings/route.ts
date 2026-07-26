import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Helper to resolve the active organization ID for the authenticated user.
 */
async function resolveActiveOrganization(supabase: any, userId: string, requestedOrgId?: string) {
  const cookieStore = await cookies();
  const activeOrgCookie = requestedOrgId || cookieStore.get("cl_active_org_id")?.value;

  if (activeOrgCookie) {
    const { data: specificRole } = await supabase
      .from("user_organization_roles")
      .select("organization_id, role, organizations(id, name, settings)")
      .eq("user_id", userId)
      .eq("organization_id", activeOrgCookie)
      .limit(1)
      .maybeSingle();

    if (specificRole?.organization_id) {
      return {
        organizationId: specificRole.organization_id,
        role: specificRole.role,
        orgData: specificRole.organizations,
      };
    }
  }

  // Fallback: Primary role for user
  const { data: primaryRole, error: roleError } = await supabase
    .from("user_organization_roles")
    .select("organization_id, role, organizations(id, name, settings)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (roleError || !primaryRole?.organization_id) {
    return null;
  }

  return {
    organizationId: primaryRole.organization_id,
    role: primaryRole.role,
    orgData: primaryRole.organizations,
  };
}

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log("[GPS DEBUG GET] Auth error or no user");
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const requestedOrgId = searchParams.get("org_id") || undefined;

    const resolved = await resolveActiveOrganization(supabase, user.id, requestedOrgId);

    if (!resolved) {
      console.log("[GPS DEBUG GET] No resolved organization");
      return NextResponse.json({ error: "No se encontró organización activa" }, { status: 404 });
    }

    // Direct DB query for fresh read
    const { data: directOrg } = await supabase
      .from("organizations")
      .select("id, settings")
      .eq("id", resolved.organizationId)
      .single();

    const dbSettings = directOrg?.settings || (resolved.orgData as any)?.settings || {};
    const isGpsEnabled = dbSettings.is_gps_enabled !== undefined ? Boolean(dbSettings.is_gps_enabled) : true;

    console.log(`[GPS DEBUG GET] organization_id = ${resolved.organizationId}`);
    console.log(`[GPS DEBUG GET] API settings.is_gps_enabled = ${isGpsEnabled}`);

    return NextResponse.json({
      success: true,
      organization_id: resolved.organizationId,
      is_gps_enabled: isGpsEnabled,
      settings: dbSettings,
    });
  } catch (err: any) {
    console.error("GET /api/organization/settings error:", err);
    return NextResponse.json({ error: err.message || "Error al obtener configuración" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log("[GPS DEBUG PATCH] Auth error or no user");
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const { settingsToUpdate, organization_id: requestedOrgId } = body;

    const resolved = await resolveActiveOrganization(supabase, user.id, requestedOrgId);

    if (!resolved) {
      console.log("[GPS DEBUG PATCH] Active organization not found");
      return NextResponse.json({ error: "Organización activa no encontrada" }, { status: 404 });
    }

    const targetOrgId = resolved.organizationId;
    console.log(`[GPS DEBUG PATCH] organization_id = ${targetOrgId}`);
    console.log(`[GPS DEBUG PATCH] payload = ${JSON.stringify(settingsToUpdate)}`);

    // Fetch latest current settings directly from organizations table
    const { data: currentOrg, error: fetchErr } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", targetOrgId)
      .single();

    if (fetchErr) {
      console.error("Error fetching current org settings for PATCH:", fetchErr);
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    const currentSettings = (currentOrg as any)?.settings || {};
    const mergedSettings = {
      ...currentSettings,
      ...settingsToUpdate,
    };

    // Execute UPDATE and verify row modification
    const { data: updatedOrg, error: updateErr } = await supabase
      .from("organizations")
      .update({ settings: mergedSettings })
      .eq("id", targetOrgId)
      .select("id, settings")
      .single();

    if (updateErr || !updatedOrg) {
      console.error("Error performing UPDATE on organizations table:", updateErr);
      return NextResponse.json({ error: updateErr?.message || "Error al actualizar fila" }, { status: 500 });
    }

    const updatedSettings = updatedOrg.settings || {};
    const finalGpsState = updatedSettings.is_gps_enabled !== undefined ? Boolean(updatedSettings.is_gps_enabled) : true;

    console.log(`[GPS DEBUG PATCH RESPONSE] organization_id = ${targetOrgId}`);
    console.log(`[GPS DEBUG PATCH RESPONSE] settings.is_gps_enabled = ${finalGpsState}`);

    // Direct verification query
    const { data: verifyOrg } = await supabase
      .from("organizations")
      .select("id, settings")
      .eq("id", targetOrgId)
      .single();

    const dbReadValue = verifyOrg?.settings?.is_gps_enabled;
    console.log(`[GPS DEBUG DB READ] organization_id = ${targetOrgId}`);
    console.log(`[GPS DEBUG DB READ] database settings.is_gps_enabled = ${dbReadValue}`);

    return NextResponse.json({
      success: true,
      organization_id: targetOrgId,
      is_gps_enabled: finalGpsState,
      settings: updatedSettings,
    });
  } catch (err: any) {
    console.error("PATCH /api/organization/settings error:", err);
    return NextResponse.json({ error: err.message || "Error interno al guardar" }, { status: 500 });
  }
}
