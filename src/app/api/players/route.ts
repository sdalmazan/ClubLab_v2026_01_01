import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createPlayer } from "@/services/players";

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
      dob,
      nationality,
      dominantFoot,
      heightCm,
      weightKg,
      jerseyNumber,
      positions,
      teamId,
      seasonId,
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
      date_of_birth: dob,
      nationality,
      dominant_foot: dominantFoot,
      height_cm: heightCm,
      weight_kg: weightKg,
      jersey_number: jerseyNumber,
      positions: positions ?? [],
      team_id: teamId,
      season_id: seasonId,
    });

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ id: player!.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
