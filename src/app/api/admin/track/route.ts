import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient();
    const body = await req.json();
    const { path, feature, type } = body;

    // Get current user if logged in
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    let userId = null;
    let userEmail = null;
    let organizationId = null;

    if (user) {
      userId = user.id;
      userEmail = user.email;

      // Fetch user's role to exclude super_admin tracking
      const { data: orgRole } = await supabase
        .from("user_organization_roles")
        .select("organization_id, role")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (orgRole) {
        organizationId = orgRole.organization_id;
        if (orgRole.role === "super_admin" || userEmail?.toLowerCase() === "diecilo7@gmail.com") {
          // Bypassed for super_admin account as requested: only track real users
          return NextResponse.json({ success: true, bypassed: "super_admin" });
        }
      }
    }


    if (type === "page_view" && path) {
      // Filter out system assets or API tracking
      if (path.startsWith("/api") || path.includes("/_next") || path.includes("favicon") || path.includes("uploads")) {
        return NextResponse.json({ success: true });
      }

      await supabaseAdmin.from("platform_page_views").insert({
        path,
        user_id: userId,
        user_email: userEmail,
        organization_id: organizationId,
      });
    } else if (type === "feature_usage" && feature) {
      await supabaseAdmin.from("platform_feature_usage").insert({
        feature_name: feature,
        user_id: userId,
        organization_id: organizationId,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Telemetry track error:", error);
    // Graceful success response so front-end does not break if table doesn't exist
    return NextResponse.json({ success: true, warning: "Telemetry bypassed" });
  }
}
