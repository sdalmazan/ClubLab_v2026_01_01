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

  // Verify Super Admin role or email matching
  const { data: orgRole } = await supabase
    .from("user_organization_roles")
    .select("role")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  const isSuperAdmin = orgRole?.role === "super_admin" || user.email === "diecilo7@gmail.com";

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

  const { data: { users: authUsers } } = await supabaseAdmin.auth.admin.listUsers();
  const { data: roles } = await supabaseAdmin.from("user_organization_roles").select("*");

  const mappedUsers = authUsers.map((au: any) => {
    const roleRecord = roles?.find((r: any) => r.user_id === au.id);
    const org = organizations?.find((o: any) => o.id === roleRecord?.organization_id);
    return {
      id: au.id,
      email: au.email,
      role: roleRecord?.role || "Ninguno",
      organization_id: roleRecord?.organization_id || null,
      organization_name: org?.name || "Ninguna",
      created_at: au.created_at,
    };
  });

  const mappedPlayers = rawPlayers?.map((p: any) => {
    const org = organizations?.find((o: any) => o.id === p.organization_id);
    return {
      ...p,
      organization_name: org?.name || "ClubLab",
    };
  }) || [];

  // JIT Telemetry aggregation and active online users calculation
  let topPages: any[] = [];
  let topFeatures: any[] = [];
  let onlineSnapshots: any[] = [];
  let dailyStats: any[] = [];
  let currentOnlineCount = 0;
  let tablesExist = true;

  try {
    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    // Compute online user count in last 5 minutes
    const { data: recentViews } = await supabaseAdmin
      .from("platform_page_views")
      .select("user_id")
      .gte("viewed_at", fiveMinsAgo);

    const uniqueOnlineUsers = new Set(recentViews?.map((v: any) => v.user_id).filter(Boolean) || []);
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

    // Retrieve Top Viewed Paths
    const { data: pageViews } = await supabaseAdmin
      .from("platform_page_views")
      .select("path")
      .limit(1000);

    if (pageViews) {
      const pageCounts: Record<string, number> = {};
      pageViews.forEach((v: any) => {
        pageCounts[v.path] = (pageCounts[v.path] || 0) + 1;
      });
      topPages = Object.entries(pageCounts)
        .map(([path, count]) => ({ path, count }))
        .sort((a: any, b: any) => b.count - a.count)
        .slice(0, 10);
    }

    // Retrieve Top Used Features
    const { data: featureUsage } = await supabaseAdmin
      .from("platform_feature_usage")
      .select("feature_name")
      .limit(1000);

    if (featureUsage) {
      const featCounts: Record<string, number> = {};
      featureUsage.forEach((f: any) => {
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
    tablesExist
  };

  return (
    <div className="animate-fade-in p-1">
      <AdminPortalClient initialData={initialData} />
    </div>
  );
}
