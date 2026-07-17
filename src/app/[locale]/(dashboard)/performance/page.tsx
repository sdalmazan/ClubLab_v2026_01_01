"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { UniversalExplorer } from "@/components/analytics/UniversalExplorer";
import { Loader2 } from "lucide-react";

/**
 * Performance Page Wrapper.
 * Resolves user credentials and active context parameters dynamically
 * on the client, feeding them to the uncoupled UniversalExplorer console.
 */
export default function PerformancePage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [context, setContext] = useState<{
    userId: string;
    organizationId: string;
    activeSeasonName: string;
    userRole: string;
  } | null>(null);

  useEffect(() => {
    async function loadUserContext() {
      try {
        // 1. Get authenticated user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          window.location.href = "/login";
          return;
        }

        // 2. Fetch user's organization role
        const { data: orgRole } = await supabase
          .from("user_organization_roles")
          .select("role, organization_id")
          .eq("user_id", user.id)
          .limit(1)
          .single();

        if (!orgRole) {
          window.location.href = "/onboarding";
          return;
        }

        // 3. Fetch active season name
        const { data: activeSeason } = await supabase
          .from("seasons")
          .select("name")
          .eq("club_id", orgRole.organization_id)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();

        setContext({
          userId: user.id,
          organizationId: orgRole.organization_id,
          activeSeasonName: activeSeason?.name || "2025/2026", // fallback season
          userRole: orgRole.role,
        });
      } catch (err) {
        console.error("Error loading performance context:", err);
      } finally {
        setLoading(false);
      }
    }

    loadUserContext();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center gap-2.5 bg-slate-950 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="text-sm font-semibold tracking-wide">Cargando consola analítica...</span>
      </div>
    );
  }

  if (!context) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-500">
        No se pudo autenticar el contexto de la organización.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8">
      <UniversalExplorer
        userId={context.userId}
        organizationId={context.organizationId}
        activeSeasonName={context.activeSeasonName}
        userRole={context.userRole}
      />
    </div>
  );
}
export const dynamic = "force-dynamic";
