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
      sportingName,
      dob,
      nationality,
      dominantFoot,
      heightCm,
      weightKg,
      physicalStatus,
      availabilityStatus,
      availabilityNotes,
      adjective,
    } = body;
    const kickerRoles: string[] | undefined = body.kickerRoles;

    const { error } = await updatePlayer(id, {
      first_name: firstName,
      last_name: lastName,
      sporting_name: sportingName || null,
      date_of_birth: dob,
      nationality,
      dominant_foot: dominantFoot,
      height_cm: heightCm,
      weight_kg: weightKg,
      physical_status: physicalStatus,
      availability_status: availabilityStatus,
      availability_notes: availabilityNotes,
      adjective,
    });

    // Update membership positions, jersey, kicker_roles, and team_id if provided
    if (body.positions !== undefined || body.jerseyNumber !== undefined || kickerRoles !== undefined || body.teamId !== undefined) {
      const updateFields: Record<string, unknown> = {};
      if (body.positions !== undefined) updateFields.positions = body.positions;
      if (body.jerseyNumber !== undefined) updateFields.jersey_number = body.jerseyNumber;
      if (kickerRoles !== undefined) updateFields.kicker_roles = kickerRoles;
      if (body.teamId !== undefined) updateFields.team_id = body.teamId;

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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode"); // "delete" | "inactive"
  const membershipId = searchParams.get("membershipId");

  try {
    const filter: Record<string, unknown> = (membershipId && membershipId !== "undefined")
      ? { id: membershipId }
      : { player_id: id };

    if (mode === "inactive") {
      // Keep history: update status to 'inactive' and set left_date to today
      const today = new Date().toISOString().split("T")[0];
      const { error } = await supabase
        .from("player_team_memberships")
        .update({ status: "inactive", left_date: today })
        .match(filter);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      // Delete completely from the team memberships
      const { error } = await supabase
        .from("player_team_memberships")
        .delete()
        .match(filter);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
