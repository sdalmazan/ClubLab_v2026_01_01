import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createPlayer, getSquadPlayers } from "@/services/players";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get("teamId") || undefined;
    const strictTeamOnly = searchParams.get("strict") === "true";

    const players = await getSquadPlayers(teamId, strictTeamOnly);
    return NextResponse.json({ success: true, players });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    const {
      organizationId,
      firstName,
      lastName,
      sportingName,
      dob,
      nationality,
      dominantFoot,
      heightCm,
      weightKg,
      jerseyNumber,
      positions,
      teamId,
      seasonId,
      adjective,
    } = body;

    if (!firstName || !lastName || !teamId || !organizationId) {
      return NextResponse.json(
        { error: "Faltan campos requeridos: nombre, apellidos y equipo" },
        { status: 400 }
      );
    }

    const { player, error } = await createPlayer(organizationId, {
      first_name: firstName,
      last_name: lastName,
      sporting_name: sportingName || null,
      date_of_birth: dob,
      nationality,
      dominant_foot: dominantFoot,
      height_cm: heightCm,
      weight_kg: weightKg,
      jersey_number: jerseyNumber,
      positions: positions ?? [],
      team_id: teamId,
      season_id: seasonId,
      adjective: adjective || null,
    });

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ id: player!.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { players, organizationId, teamId, seasonId } = await request.json();
    if (!Array.isArray(players)) {
      return NextResponse.json({ error: "Datos no válidos" }, { status: 400 });
    }

    const promises = players.map(async (p: any) => {
      // 1. Delete player
      if (p.isDeleted) {
        if (!p.id.startsWith("temp_") && !p.id.startsWith("new_")) {
          const { error: deleteError } = await supabase
            .from("players")
            .delete()
            .eq("id", p.id);
          if (deleteError) throw new Error(deleteError.message);
        }
        return;
      }

      // 2. Insert new player
      if (p.id.startsWith("temp_") || p.id.startsWith("new_")) {
        const { player, error: createError } = await createPlayer(p.organizationId || organizationId, {
          first_name: p.firstName,
          last_name: p.lastName,
          sporting_name: p.sportingName || null,
          date_of_birth: p.birthYear ? `${p.birthYear}-01-01` : null,
          nationality: p.nationality || null,
          dominant_foot: p.dominantFoot || "right",
          jersey_number: p.jerseyNumber ? Number(p.jerseyNumber) : null,
          positions: p.positions ?? [],
          team_id: p.teamId || teamId,
          season_id: p.seasonId || seasonId,
          adjective: p.adjective || null,
          signing_status: p.signingStatus || "signed",
          player_type: p.playerType || "main",
        });
        if (createError) throw new Error(createError);
        return;
      }

      // 3. Update existing player
      const { error: playerError } = await supabase
        .from("players")
        .update({
          first_name: p.firstName,
          last_name: p.lastName,
          sporting_name: p.sportingName || null,
          nationality: p.nationality || null,
          dominant_foot: p.dominantFoot || null,
          adjective: p.adjective || null,
          signing_status: p.signingStatus || "signed",
          date_of_birth: p.birthYear ? `${p.birthYear}-01-01` : null,
        })
        .eq("id", p.id);

      if (playerError) throw new Error(playerError.message);

      // Update active team membership jersey number, positions, status, and player_type
      const { data: existingMember, error: checkError } = await supabase
        .from("player_team_memberships")
        .select("id")
        .eq("player_id", p.id)
        .maybeSingle();

      if (checkError) throw new Error(checkError.message);

      const membershipStatus = p.status || "active";

      if (existingMember) {
        const { error: memberError } = await supabase
          .from("player_team_memberships")
          .update({
            jersey_number: p.jerseyNumber ? Number(p.jerseyNumber) : null,
            positions: p.positions ?? [],
            player_type: p.playerType || "main",
            status: membershipStatus,
            left_date: membershipStatus === "inactive" ? new Date().toISOString().split("T")[0] : null,
          })
          .eq("id", existingMember.id);
        if (memberError) throw new Error(memberError.message);
      } else {
        const { error: memberError } = await supabase
          .from("player_team_memberships")
          .insert({
            player_id: p.id,
            team_id: p.teamId || teamId,
            season_id: p.seasonId || seasonId,
            status: membershipStatus,
            jersey_number: p.jerseyNumber ? Number(p.jerseyNumber) : null,
            positions: p.positions ?? [],
            player_type: p.playerType || "main",
          });
        if (memberError) throw new Error(memberError.message);
      }
    });

    await Promise.all(promises);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
