"use client";

import { useState, useEffect } from "react";
import { PhysioWorkspace } from "@/components/injuries/PhysioWorkspace";
import { createClient } from "@/lib/supabase/client";

export default function InjuriesPage() {
  const [players, setPlayers] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<string>("physio");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPageData() {
      try {
        setLoading(true);
        const supabase = createClient();

        // Fetch auth user and players in parallel to eliminate page transition lag
        const [userRes, playersRes] = await Promise.all([
          supabase.auth.getUser(),
          fetch("/api/players")
        ]);

        if (userRes.data?.user) {
          const { data: orgRole } = await supabase
            .from("user_organization_roles")
            .select("role")
            .eq("user_id", userRes.data.user.id)
            .maybeSingle();
          if (orgRole?.role) {
            setUserRole(orgRole.role);
          }
        }

        if (playersRes.ok) {
          const data = await playersRes.json();
          setPlayers(data.players || []);
        }
      } catch (err) {
        console.error("Error loading injuries page:", err);
      } finally {
        setLoading(false);
      }
    }

    loadPageData();
  }, []);

  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-muted-foreground animate-pulse">
        Cargando espacio de enfermería y readaptación...
      </div>
    );
  }

  return (
    <PhysioWorkspace
      squadPlayers={players}
      userRole={userRole}
    />
  );
}
