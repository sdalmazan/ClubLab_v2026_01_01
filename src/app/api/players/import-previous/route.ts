import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const toTitleCase = (str: string) => {
  if (!str) return "";
  return str
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { teamId, seasonId, players } = await request.json();

    if (!teamId || !seasonId || !players || !Array.isArray(players)) {
      return NextResponse.json(
        { error: "Faltan campos requeridos o formato incorrecto" },
        { status: 400 }
      );
    }

    // 1. Get organization ID from team
    const { data: team, error: teamErr } = await supabase
      .from("teams")
      .select(`
        club_id,
        clubs (
          organization_id
        )
      `)
      .eq("id", teamId)
      .single();

    if (teamErr || !team) {
      return NextResponse.json({ error: "Equipo u Organización no encontrados" }, { status: 404 });
    }

    const orgId = (team as any).clubs?.organization_id;

    if (!orgId) {
      return NextResponse.json({ error: "ID de Organización no disponible" }, { status: 400 });
    }

    let importCount = 0;

    // 2. Process each player import
    for (const p of players) {
      if (!p || !p.name) continue;

      const fullName = p.name;
      let playerId = p.id;

      if (playerId) {
        // Player already exists in main database, just check if they are already in this team/season
        const { data: existingMem } = await supabase
          .from("player_team_memberships")
          .select("id")
          .eq("player_id", playerId)
          .eq("team_id", teamId)
          .eq("season_id", seasonId);

        if (existingMem && existingMem.length > 0) {
          continue; // Skip already active member
        }
      } else {
        // Player only in scraped statistics database, format and see if they exist in main DB under the org
        let firstName = "";
        let lastName = "";

        if (fullName.includes(",")) {
          const parts = fullName.split(",");
          lastName = parts[0].trim();
          firstName = parts[1].trim();
        } else {
          const parts = fullName.trim().split(" ");
          firstName = parts[0] || "";
          lastName = parts.slice(1).join(" ") || "";
        }

        firstName = toTitleCase(firstName);
        lastName = toTitleCase(lastName);

        const { data: matchedPlayers } = await supabase
          .from("players")
          .select(`
            id,
            player_team_memberships (
              id,
              team_id,
              season_id
            )
          `)
          .eq("organization_id", orgId)
          .eq("first_name", firstName)
          .eq("last_name", lastName);

        const alreadyMember = matchedPlayers?.some((p) =>
          p.player_team_memberships?.some(
            (m: any) => m.team_id === teamId && m.season_id === seasonId
          )
        );

        if (alreadyMember) {
          continue; // Skip already active member
        }

        // Re-use existing player record under the org if they exist, otherwise create a new one!
        playerId = matchedPlayers?.[0]?.id;

        if (!playerId) {
          const { data: newPlayer, error: playerErr } = await supabase
            .from("players")
            .insert({
              organization_id: orgId,
              first_name: firstName,
              last_name: lastName,
            })
            .select("id")
            .single();

          if (playerErr) {
            console.error("Error creating player record:", playerErr.message);
            continue;
          }
          playerId = newPlayer.id;
        }
      }

      // Add team membership
      const { error: memErr } = await supabase.from("player_team_memberships").insert({
        player_id: playerId,
        team_id: teamId,
        season_id: seasonId,
        jersey_number: null,
        positions: [],
        status: "active",
        joined_date: new Date().toISOString().split("T")[0],
        player_type: "main",
      });

      if (memErr) {
        console.error("Error creating player membership:", memErr.message);
      } else {
        importCount++;
      }
    }

    return NextResponse.json({ success: true, imported: importCount });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
