import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updatePlayer } from "@/services/players";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const body = await request.json();
    const {
      firstName,
      lastName,
      dob,
      nationality,
      dominantFoot,
      heightCm,
      weightKg,
      physicalStatus,
      availabilityStatus,
      availabilityNotes,
    } = body;
    const kickerRoles: string[] | undefined = body.kickerRoles;

    const { error } = await updatePlayer(id, {
      first_name: firstName,
      last_name: lastName,
      date_of_birth: dob,
      nationality,
      dominant_foot: dominantFoot,
      height_cm: heightCm,
      weight_kg: weightKg,
      physical_status: physicalStatus,
      availability_status: availabilityStatus,
      availability_notes: availabilityNotes,
    });

    // Update membership positions, jersey, and kicker_roles if provided
    if (body.positions !== undefined || body.jerseyNumber !== undefined || kickerRoles !== undefined) {
      const updateFields: Record<string, unknown> = {};
      if (body.positions !== undefined) updateFields.positions = body.positions;
      if (body.jerseyNumber !== undefined) updateFields.jersey_number = body.jerseyNumber;
      if (kickerRoles !== undefined) updateFields.kicker_roles = kickerRoles;

      await supabase
        .from("player_team_memberships")
        .update(updateFields)
        .eq("player_id", id)
        .eq("status", "active");
    }

    if (error) return NextResponse.json({ error }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
