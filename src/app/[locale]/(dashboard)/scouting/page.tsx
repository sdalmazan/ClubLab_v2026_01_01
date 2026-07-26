"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { UniversalExplorer } from "@/components/analytics/UniversalExplorer";
import { PageHeader } from "@/components/ui/page-header";
import { Loader2 } from "lucide-react";

export default function ScoutingPage() {
  const [context, setContext] = useState<{
    userId: string;
    organizationId: string;
    activeSeasonName: string;
    userRole: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadContext() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: orgRole } = await supabase
            .from("user_organization_roles")
            .select("organization_id, role")
            .eq("user_id", user.id)
            .limit(1)
            .single();

          setContext({
            userId: user.id,
            organizationId: orgRole?.organization_id || "default-org",
            activeSeasonName: "2026/2027",
            userRole: orgRole?.role || "head_coach",
          });
        }
      } catch (err) {
        console.error("Error cargando el contexto para Scouting:", err);
      } finally {
        setLoading(false);
      }
    }
    loadContext();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-muted-foreground space-y-2">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="text-xs font-medium">Cargando Explorador Universal de Scouting...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in text-white">
      <PageHeader
        title="Explorador Universal de Scouting & Análisis de Mercado"
        description="Filtra por posición, equipo o liga. Compara métricas avanzadas (xG, ACWR, Asistencias) y genera radar gráficos de rendimiento."
      />

      <UniversalExplorer
        userId={context?.userId || ""}
        organizationId={context?.organizationId || ""}
        activeSeasonName={context?.activeSeasonName || "2026/2027"}
        userRole={context?.userRole || "head_coach"}
        defaultCompetition="Tercera Federación - Grupo 8"
      />
    </div>
  );
}
