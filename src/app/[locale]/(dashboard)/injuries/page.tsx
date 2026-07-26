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
        const res = await fetch("/api/scouting/players?team=C.D. Almazán");
        if (res.ok) {
          const data = await res.json();
          const formatted = data.map((p: any, idx: number) => {
            const parts = (p.player_name || "").split(",");
            const lastName = parts[0]?.trim() || p.player_name;
            const firstName = parts[1]?.trim() || "";

            return {
              id: p.id || `player-${idx}`,
              first_name: firstName || lastName,
              last_name: firstName ? lastName : "",
              membership: {
                jersey_number: p.shirt_number
              }
            };
          });
          setPlayers(formatted);
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
