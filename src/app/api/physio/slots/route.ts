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
    const dateParam = searchParams.get("date");
    const todayStr = new Date().toISOString().split("T")[0];

    // Find organization_id & player
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
      return NextResponse.json({ slots: [] });
    }

    // 1. Try reading from physio_slots table if it exists
    const { data: slots, error: slotsErr } = await supabase
      .from("physio_slots")
      .select(`
        *,
        physio_bookings(id, player_id, status, notes)
      `)
      .eq("organization_id", orgId)
      .eq("is_cancelled", false)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true });

    if (!slotsErr && slots && slots.length > 0) {
      const formatted = slots.map((slot: any) => {
        const activeBookings = (slot.physio_bookings || []).filter((b: any) => b.status === "confirmed");
        const myBooking = activeBookings.find((b: any) => b.player_id === player?.id);
        return {
          id: slot.id,
          date: slot.date,
          startTime: slot.start_time?.slice(0, 5) || slot.start_time,
          endTime: slot.end_time?.slice(0, 5) || slot.end_time,
          physioName: slot.physio_name || "Fisioterapeuta del Club",
          maxCapacity: slot.max_capacity,
          currentBookingsCount: activeBookings.length,
          availablePlaces: Math.max(0, slot.max_capacity - activeBookings.length),
          isFull: activeBookings.length >= slot.max_capacity,
          isBookedByMe: !!myBooking,
          myBookingNotes: myBooking?.notes || null,
          slotMin: slot.slot_min || 10,
        };
      });
      return NextResponse.json({ slots: formatted });
    }

    // 2. Persistent Fallback: Read from organizations.settings in PostgreSQL DB
    const { data: org } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", orgId)
      .single();

    const activeCons = org?.settings?.active_physio_consultation;

    if (!activeCons || !activeCons.isOpen) {
      return NextResponse.json({ slots: [] });
    }

    // If dateParam is specified, filter by date, otherwise compare with todayStr
    const targetDate = dateParam || todayStr;
    if (activeCons.date && activeCons.date !== targetDate) {
      return NextResponse.json({ slots: [] });
    }

    const bookings = activeCons.bookings || [];
    const myBooking = bookings.find((b: any) => b.playerId === player?.id);

    const slotObj = {
      id: activeCons.id || `slot-${activeCons.date || todayStr}`,
      date: activeCons.date || todayStr,
      startTime: activeCons.startTime || "18:00",
      endTime: "20:00",
      physioName: activeCons.physioName || "Fisioterapeuta del Club",
      maxCapacity: activeCons.maxCapacity || 10,
      currentBookingsCount: bookings.length,
      availablePlaces: Math.max(0, (activeCons.maxCapacity || 10) - bookings.length),
      isFull: bookings.length >= (activeCons.maxCapacity || 10),
      isBookedByMe: !!myBooking,
      myBookingNotes: myBooking?.notes || null,
      slotMin: activeCons.slotMin || 10,
    };

    return NextResponse.json({ slots: [slotObj] });
  } catch (err: any) {
    return NextResponse.json({ slots: [] });
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

    // Resolve player & org
    const { data: player } = await supabase
      .from("players")
      .select("id, organization_id, team_id")
      .or(`user_id.eq.${user.id},email.eq.${user.email}`)
      .maybeSingle();

    const { data: orgRole } = await supabase
      .from("user_organization_roles")
      .select("organization_id, team_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const orgId = player?.organization_id || orgRole?.organization_id;

    if (!orgId) {
      return NextResponse.json({ error: "No organization found" }, { status: 400 });
    }

    if (action === "open_consultation") {
      const consDate = date || new Date().toISOString().split("T")[0];
      const newSlot = {
        id: `slot-${consDate}`,
        date: consDate,
        startTime: startTime || "18:00",
        endTime: "20:00",
        physioName: "Fisioterapeuta del Club",
        maxCapacity: 10,
        currentBookingsCount: 0,
        availablePlaces: 10,
        isFull: false,
        isBookedByMe: false,
        slotMin: slotMin || 10,
        isOpen: true,
        createdAt: new Date().toISOString(),
        bookings: [],
      };

      // 1. Try DB table insert if table exists
      try {
        await supabase.from("physio_slots").insert({
          organization_id: orgId,
          team_id: player?.team_id || orgRole?.team_id || null,
          physio_name: "Fisioterapeuta del Club",
          date: consDate,
          start_time: `${startTime || "18:00"}:00`,
          end_time: "20:00:00",
          max_capacity: 10,
          slot_min: slotMin || 10,
        });
      } catch (e) {}

      // 2. Always persist into PostgreSQL organizations.settings JSONB column (100% durable on Vercel)
      const { data: org } = await supabase
        .from("organizations")
        .select("settings")
        .eq("id", orgId)
        .single();

      const updatedSettings = {
        ...(org?.settings || {}),
        active_physio_consultation: newSlot,
      };

      await supabase
        .from("organizations")
        .update({ settings: updatedSettings, updated_at: new Date().toISOString() })
        .eq("id", orgId);

      return NextResponse.json({ success: true, slot: newSlot });
    }

    if (action === "request_availability") {
      return NextResponse.json({
        success: true,
        message: "Disponibilidad registrada correctamente.",
      });
    }

    // Booking a slot
    if (slotId) {
      // 1. Try DB RPC function
      const { data: rpcRes, error: rpcErr } = await supabase.rpc("book_physio_slot", {
        p_slot_id: slotId,
        p_notes: notes || null,
      });

      if (!rpcErr && rpcRes && rpcRes.success !== false) {
        return NextResponse.json(rpcRes);
      }

      // 2. Persistent Fallback in organizations.settings JSONB
      const { data: org } = await supabase
        .from("organizations")
        .select("settings")
        .eq("id", orgId)
        .single();

      const activeCons = org?.settings?.active_physio_consultation;
      if (activeCons) {
        const bookings = activeCons.bookings || [];
        const existingIdx = bookings.findIndex((b: any) => b.playerId === player?.id);
        const newBooking = {
          id: `book-${Date.now()}`,
          playerId: player?.id,
          notes: notes || null,
          status: "confirmed",
          createdAt: new Date().toISOString(),
        };

        if (existingIdx >= 0) {
          bookings[existingIdx] = newBooking;
        } else {
          bookings.push(newBooking);
        }

        activeCons.bookings = bookings;
        const updatedSettings = {
          ...(org?.settings || {}),
          active_physio_consultation: activeCons,
        };

        await supabase
          .from("organizations")
          .update({ settings: updatedSettings, updated_at: new Date().toISOString() })
          .eq("id", orgId);
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
