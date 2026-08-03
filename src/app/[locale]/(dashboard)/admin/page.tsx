import React from "react";
import { notFound, redirect } from "next/navigation";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminPortalClient } from "@/components/layout/AdminPortalClient";

export const dynamic = "force-dynamic";

export default async function AdminPortalPage() {
  const supabaseAdmin = createAdminClient();
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Verify Admin role or additive is_admin flag
  const { data: orgRoles } = await supabase
    .from("user_organization_roles")
    .select("role, is_admin")
    .eq("user_id", user.id);

  const hasAdminRole = orgRoles?.some((r: any) => r.role === "super_admin" || r.role === "club_admin" || r.is_admin === true);
  const isSuperAdmin = hasAdminRole || user.email === "diecilo7@gmail.com" || user.user_metadata?.is_admin === true;

  if (!isSuperAdmin) {
    notFound();
  }

  // Load registered organizations, clubs, players, and user details
  const { data: organizations } = await supabaseAdmin
    .from("organizations")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: rawPlayers } = await supabaseAdmin
    .from("players")
    .select("*")
    .order("created_at", { ascending: false });

  const filteredPlayers = (rawPlayers ?? []).filter(
    (p: any) => p.adjective !== "invisible" && p.is_invisible !== true
  );

  const { data: { users: authUsers } } = await supabaseAdmin.auth.admin.listUsers();
  const { data: roles } = await supabaseAdmin.from("user_organization_roles").select("*");

  const mappedUsers = authUsers.map((au: any) => {
    const roleRecord = roles?.find((r: any) => r.user_id === au.id);
    const orgId = roleRecord?.organization_id || au.user_metadata?.organization_id || null;
    const roleVal = roleRecord?.role || au.user_metadata?.role || "Ninguno";
    const org = organizations?.find((o: any) => o.id === orgId);
    const isAdmin = roleVal === "super_admin" || roleVal === "club_admin" || (roleRecord as any)?.is_admin === true || au.user_metadata?.is_admin === true || au.email === "diecilo7@gmail.com";
    return {
      id: au.id,
      email: au.email,
      role: roleVal,
      is_admin: Boolean(isAdmin),
      organization_id: orgId,
      organization_name: org?.name || "Ninguna",
      created_at: au.created_at,
    };
  });

  const mappedPlayers = filteredPlayers?.map((p: any) => {
    const org = organizations?.find((o: any) => o.id === p.organization_id);
    return {
      ...p,
      organization_name: org?.name || "ClubLab",
    };
  }) || [];

  // Load pending self-registration approval requests
  const { data: pendingInvitations } = await supabaseAdmin
    .from("player_invitations")
    .select("*")
    .eq("status", "pending_approval")
    .order("created_at", { ascending: false });

  // JIT Telemetry aggregation and active online users calculation
  let topPages: any[] = [];
  let topFeatures: any[] = [];
  let onlineSnapshots: any[] = [];
  let dailyStats: any[] = [];
  let currentOnlineCount = 0;
  let tablesExist = true;

  // Exclude test / superadmin accounts from telemetry metrics
  const excludedEmails = ["diecilo7@gmail.com", "diego.ciria.lopez@gmail.com"];
  const excludedUserIds = new Set(
    authUsers
      .filter((au: any) => au.email && excludedEmails.includes(au.email.toLowerCase().trim()))
      .map((au: any) => au.id)
  );

  try {
    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    // Compute online user count in last 5 minutes (excluding test/superadmin accounts)
    const { data: recentViews } = await supabaseAdmin
      .from("platform_page_views")
      .select("user_id")
      .gte("viewed_at", fiveMinsAgo);

    const realViews = (recentViews ?? []).filter(
      (v: any) => v.user_id && !excludedUserIds.has(v.user_id)
    );
    const uniqueOnlineUsers = new Set(realViews.map((v: any) => v.user_id));
    currentOnlineCount = uniqueOnlineUsers.size;

    // Check if we need to log a new 5-minute online users snapshot
    const { data: recentSnap } = await supabaseAdmin
      .from("platform_online_users")
      .select("*")
      .order("checked_at", { ascending: false })
      .limit(1)
      .single();

    const shouldLogSnap = !recentSnap || (Date.now() - new Date(recentSnap.checked_at).getTime()) > 5 * 60 * 1000;
    if (shouldLogSnap) {
      await supabaseAdmin.from("platform_online_users").insert({ online_count: currentOnlineCount });
    }

    // Retrieve Top Viewed Paths (excluding superadmin views)
    const { data: pageViews } = await supabaseAdmin
      .from("platform_page_views")
      .select("user_id, path")
      .limit(3000);

    if (pageViews) {
      const realPageViews = pageViews.filter((v: any) => !v.user_id || !excludedUserIds.has(v.user_id));
      const pageCounts: Record<string, number> = {};
      realPageViews.forEach((v: any) => {
        pageCounts[v.path] = (pageCounts[v.path] || 0) + 1;
      });
      topPages = Object.entries(pageCounts)
        .map(([path, count]) => ({ path, count }))
        .sort((a: any, b: any) => b.count - a.count)
        .slice(0, 10);
    }

    // Retrieve Top Used Features (excluding superadmin clicks)
    const { data: featureUsage } = await supabaseAdmin
      .from("platform_feature_usage")
      .select("user_id, feature_name")
      .limit(3000);

    if (featureUsage) {
      const realFeatures = featureUsage.filter((f: any) => !f.user_id || !excludedUserIds.has(f.user_id));
      const featCounts: Record<string, number> = {};
      realFeatures.forEach((f: any) => {
        featCounts[f.feature_name] = (featCounts[f.feature_name] || 0) + 1;
      });
      topFeatures = Object.entries(featCounts)
        .map(([feature_name, count]) => ({ feature_name, count }))
        .sort((a: any, b: any) => b.count - a.count)
        .slice(0, 10);
    }

    // Retrieve History snaps
    const { data: snaps } = await supabaseAdmin
      .from("platform_online_users")
      .select("*")
      .order("checked_at", { ascending: false })
      .limit(20);
    onlineSnapshots = snaps || [];

    // Retrieve Daily summary stats
    const { data: dStats } = await supabaseAdmin
      .from("platform_daily_usage_stats")
      .select("*")
      .order("date", { ascending: false })
      .limit(30);
    dailyStats = dStats || [];

  } catch (error) {
    console.warn("Analytics telemetry not yet initialized or table missing:", error);
    tablesExist = false;
  }

  const initialData = {
    organizations: organizations || [],
    users: mappedUsers,
    players: mappedPlayers,
    onlineSnapshots,
    dailyStats,
    topPages,
    topFeatures,
    currentOnlineCount,
    tablesExist,
    pendingInvitations: pendingInvitations || [],
  };

  return (
    <div className="animate-fade-in p-1">
      <AdminPortalClient initialData={initialData} />
    </div>
  );
}
