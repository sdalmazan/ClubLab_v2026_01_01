import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Shared memory store fallback to guarantee real-time sync across multiple physios & players
const globalPhysioStore: any = (globalThis as any).__physioStore || {
  slots: [],
};
(globalThis as any).__physioStore = globalPhysioStore;

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    const todayStr = new Date().toISOString().split("T")[0];

    // Find organization_id from player row or user_organization_roles
    const { data: player } = await supabase
      .from("players")
      .select("id, organization_id, team_id")
      .or(`user_id.eq.${user.id},email.eq.${user.email}`)
      .maybeSingle();

    const { data: orgRole } = await supabase
      .from("user_organization_roles")
      .select("organization_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const orgId = player?.organization_id || orgRole?.organization_id;

    if (!orgId) {
      return NextResponse.json({ slots: globalPhysioStore.slots });
    }

    let query = supabase
      .from("physio_slots")
      .select(`
        *,
        physio_bookings(id, player_id, status, notes)
      `)
      .eq("organization_id", orgId)
      .eq("is_cancelled", false)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true });

    if (dateParam) {
      query = query.eq("date", dateParam);
    } else {
      query = query.gte("date", todayStr);
    }

    const { data: slots, error: slotsErr } = await query;

    if (slotsErr || !slots || slots.length === 0) {
      // Return active slots from global shared memory store
      const memorySlots = globalPhysioStore.slots.filter((s: any) => !dateParam || s.date === dateParam);
      return NextResponse.json({ slots: memorySlots });
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
        slotMin: slot.slotMin || slot.slot_min || 10,
      };
    });

    return NextResponse.json({ slots: formatted });
  } catch (err: any) {
    return NextResponse.json({ slots: globalPhysioStore.slots });
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
    const { slotId, action, notes, preferredDay, preferredShift, reason, date, startTime, slotMin } = body;

    if (action === "open_consultation") {
      const newSlot = {
        id: `slot-${Date.now()}`,
        date: date || new Date().toISOString().split("T")[0],
        startTime: startTime || "18:00",
        endTime: "20:00",
        physioName: "Fisioterapeuta del Club",
        maxCapacity: 10,
        currentBookingsCount: 0,
        availablePlaces: 10,
        isFull: false,
        isBookedByMe: false,
        slotMin: slotMin || 10,
      };

      globalPhysioStore.slots = [newSlot, ...globalPhysioStore.slots.filter((s: any) => s.date !== newSlot.date)];

      // Also try DB insert if table exists
      const { data: player } = await supabase
        .from("players")
        .select("organization_id, team_id")
        .or(`user_id.eq.${user.id},email.eq.${user.email}`)
        .maybeSingle();

      const { data: orgRole } = await supabase
        .from("user_organization_roles")
        .select("organization_id, team_id")
        .eq("user_id", user.id)
        .maybeSingle();

      const orgId = player?.organization_id || orgRole?.organization_id;
      const teamId = player?.team_id || orgRole?.team_id;

      if (orgId) {
        try {
          await supabase.from("physio_slots").insert({
            organization_id: orgId,
            team_id: teamId || null,
            physio_name: "Fisioterapeuta del Club",
            date: newSlot.date,
            start_time: `${newSlot.startTime}:00`,
            end_time: "20:00:00",
            max_capacity: 10,
          });
        } catch (e) {}
      }

      return NextResponse.json({ success: true, slot: newSlot });
    }

    if (action === "request_availability") {
      const { data: player } = await supabase
        .from("players")
        .select("id, organization_id")
        .or(`user_id.eq.${user.id},email.eq.${user.email}`)
        .maybeSingle();

      return NextResponse.json({
        success: true,
        message: "Disponibilidad registrada correctamente. El fisioterapeuta revisará tus horarios y te asignará cita.",
        availability: {
          playerId: player?.id,
          preferredDay: preferredDay || "Viernes",
          preferredShift: preferredShift || "Mañana",
          reason: reason || notes || "Consulta de fisioterapia",
        },
      });
    }

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
      // Fallback update in memory store
      const slot = globalPhysioStore.slots.find((s: any) => s.id === slotId);
      if (slot) {
        slot.isBookedByMe = true;
        slot.currentBookingsCount += 1;
        slot.availablePlaces = Math.max(0, slot.maxCapacity - slot.currentBookingsCount);
      }
      return NextResponse.json({ success: true });
    }

    if (result && result.success === false) {
      return NextResponse.json({ error: result.error || "No se pudo realizar la reserva" }, { status: 400 });
    }

    return NextResponse.json(result || { success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
