"use client";

import { useState, useEffect } from "react";
import { PhysioWorkspace } from "@/components/injuries/PhysioWorkspace";

export default function InjuriesPage() {
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSquad() {
      try {
        setLoading(true);
        const res = await fetch("/api/players");
        if (res.ok) {
          const data = await res.json();
          setPlayers(data.players || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadSquad();
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
      userRole="physio"
    />
  );
}
