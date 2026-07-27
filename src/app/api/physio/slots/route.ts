import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date") || new Date().toISOString().split("T")[0];

    // Find player row for organization
    const { data: player } = await supabase
      .from("players")
      .select("id, organization_id, team_id")
      .or(`user_id.eq.${user.id},email.eq.${user.email}`)
      .maybeSingle();

    const orgId = player?.organization_id;

    if (!orgId) {
      return NextResponse.json({ slots: [] });
    }

    // Fetch slots for date
    const { data: slots, error: slotsErr } = await supabase
      .from("physio_slots")
      .select(`
        *,
        physio_bookings(id, player_id, status, notes)
      `)
      .eq("organization_id", orgId)
      .eq("date", dateStr)
      .eq("is_cancelled", false)
      .order("start_time", { ascending: true });

    if (slotsErr) {
      return NextResponse.json({ slots: [], error: slotsErr.message });
    }

    // Process availability & player's booking status
    const formatted = (slots || []).map((slot: any) => {
      const activeBookings = (slot.physio_bookings || []).filter((b: any) => b.status === "confirmed");
      const myBooking = activeBookings.find((b: any) => b.player_id === player?.id);
      const isBookedByMe = !!myBooking;
      const isFull = activeBookings.length >= slot.max_capacity;

      return {
        id: slot.id,
        date: slot.date,
        startTime: slot.start_time?.slice(0, 5) || slot.start_time,
        endTime: slot.end_time?.slice(0, 5) || slot.end_time,
        physioName: slot.physio_name || "Fisioterapeuta del Club",
        maxCapacity: slot.max_capacity,
        currentBookingsCount: activeBookings.length,
        availablePlaces: Math.max(0, slot.max_capacity - activeBookings.length),
        isFull,
        isBookedByMe,
        myBookingNotes: myBooking?.notes || null,
      };
    });

    return NextResponse.json({ slots: formatted });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
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
    const { slotId, action, notes } = body;

    if (!slotId) {
      return NextResponse.json({ error: "Missing slotId" }, { status: 400 });
    }

    if (action === "cancel") {
      const { data: result, error } = await supabase.rpc("cancel_physio_booking", {
        p_slot_id: slotId,
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json(result || { success: true });
    }

    // Call atomic RPC function against overbooking
    const { data: result, error } = await supabase.rpc("book_physio_slot", {
      p_slot_id: slotId,
      p_notes: notes || null,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (result && result.success === false) {
      return NextResponse.json({ error: result.error || "No se pudo realizar la reserva" }, { status: 400 });
    }

    return NextResponse.json(result || { success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
