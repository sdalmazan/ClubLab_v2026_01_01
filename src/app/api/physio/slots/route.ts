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
      return NextResponse.json({ slots: [], appointments: [] });
    }

    // Read organization settings for consultations & appointments
    const { data: org } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", orgId)
      .single();

    const settings = org?.settings || {};
    let consList: any[] = Array.isArray(settings.physio_consultations) ? settings.physio_consultations : [];
    if (settings.active_physio_consultation && !consList.some((c: any) => c.date === settings.active_physio_consultation.date)) {
      consList.push(settings.active_physio_consultation);
    }

    // Filter active open consultations
    let activeOpenCons = consList.filter((c: any) => c && c.isOpen !== false);

    if (dateParam) {
      activeOpenCons = activeOpenCons.filter((c: any) => c.date === dateParam);
    } else {
      activeOpenCons = activeOpenCons.filter((c: any) => !c.date || c.date >= todayStr);
    }

    activeOpenCons.sort((a: any, b: any) => (a.date || "").localeCompare(b.date || ""));

    const formattedSlots = activeOpenCons.map((activeCons: any) => {
      const bookings = activeCons.bookings || [];
      const myBooking = bookings.find((b: any) => b.playerId === player?.id);

      return {
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
    });

    // Retrieve saved appointments
    let appList: any[] = Array.isArray(settings.physio_appointments) ? settings.physio_appointments : [];

    if (dateParam) {
      appList = appList.filter((a: any) => a.date === dateParam);
    }

    return NextResponse.json({ slots: formattedSlots, appointments: appList });
  } catch (err: any) {
    return NextResponse.json({ slots: [], appointments: [] });
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
      slotId, 
      action, 
      notes, 
      preferredDay, 
      preferredShift, 
      reason, 
      date, 
      startTime, 
      slotMin, 
      selectedTimeSlots,
      appointmentId,
      scheduled_time,
      status,
      fitness_result,
      playerId,
      playerName,
      jerseyNumber
    } = body;

    // Resolve player & org
    const { data: playerRow } = await supabase
      .from("players")
      .select(`
        id,
        first_name,
        last_name,
        sporting_name,
        organization_id,
        team_id,
        player_team_memberships(jersey_number)
      `)
      .or(`user_id.eq.${user.id},email.eq.${user.email}`)
      .maybeSingle();

    const { data: orgRole } = await supabase
      .from("user_organization_roles")
      .select("organization_id, team_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const orgId = playerRow?.organization_id || orgRole?.organization_id;

    if (!orgId) {
      return NextResponse.json({ error: "No organization found" }, { status: 400 });
    }

    const { data: org } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", orgId)
      .single();

    const existingSettings = org?.settings || {};
    let appList: any[] = Array.isArray(existingSettings.physio_appointments) ? [...existingSettings.physio_appointments] : [];
    let consList: any[] = Array.isArray(existingSettings.physio_consultations) ? [...existingSettings.physio_consultations] : [];

    // ── 1. OPEN CONSULTATION ──
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

      const idx = consList.findIndex((c: any) => c.date === consDate);
      if (idx >= 0) {
        consList[idx] = { ...consList[idx], ...newSlot, bookings: consList[idx].bookings || [] };
      } else {
        consList.push(newSlot);
      }

      const updatedSettings = {
        ...existingSettings,
        active_physio_consultation: newSlot,
        physio_consultations: consList,
      };

      await supabase
        .from("organizations")
        .update({ settings: updatedSettings, updated_at: new Date().toISOString() })
        .eq("id", orgId);

      return NextResponse.json({ success: true, slot: newSlot });
    }

    // ── 2. DELETE CONSULTATION ──
    if (action === "delete_consultation") {
      const targetDate = date || new Date().toISOString().split("T")[0];
      consList = consList.filter((c: any) => c.date !== targetDate);

      const activeCons = existingSettings.active_physio_consultation;
      const updatedActive = activeCons && activeCons.date === targetDate ? null : activeCons;

      const updatedSettings = {
        ...existingSettings,
        active_physio_consultation: updatedActive,
        physio_consultations: consList,
      };

      await supabase
        .from("organizations")
        .update({ settings: updatedSettings, updated_at: new Date().toISOString() })
        .eq("id", orgId);

      return NextResponse.json({ success: true, message: "Consulta eliminada" });
    }

    // ── 3. UPDATE APPOINTMENT (BY PHYSIO) ──
    if (action === "update_appointment" && appointmentId) {
      const idx = appList.findIndex((a: any) => a.id === appointmentId);
      if (idx >= 0) {
        appList[idx] = {
          ...appList[idx],
          scheduled_time: scheduled_time !== undefined ? scheduled_time : appList[idx].scheduled_time,
          status: status !== undefined ? status : appList[idx].status,
          fitness_result: fitness_result !== undefined ? fitness_result : appList[idx].fitness_result,
          notes: notes !== undefined ? notes : appList[idx].notes,
          updated_at: new Date().toISOString(),
        };

        const updatedSettings = {
          ...existingSettings,
          physio_appointments: appList,
        };

        await supabase
          .from("organizations")
          .update({ settings: updatedSettings, updated_at: new Date().toISOString() })
          .eq("id", orgId);

        return NextResponse.json({ success: true, appointment: appList[idx] });
      }
    }

    // ── 4. ADD APPOINTMENT (MANUALLY BY PHYSIO OR PLAYER) ──
    if (action === "add_appointment") {
      const targetDate = date || preferredDay || new Date().toISOString().split("T")[0];
      const newApp = {
        id: `app-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        consultation_id: `cons-${targetDate}`,
        player_id: playerId || `p-${Date.now()}`,
        player_name: playerName || "Jugador",
        jersey_number: jerseyNumber != null ? Number(jerseyNumber) : null,
        reason: reason || notes || "Consulta de Fisioterapia",
        status: scheduled_time ? "scheduled" : "pending",
        scheduled_time: scheduled_time || undefined,
        notes: notes || null,
        date: targetDate,
        created_at: new Date().toISOString(),
      };

      appList.push(newApp);

      const updatedSettings = {
        ...existingSettings,
        physio_appointments: appList,
      };

      await supabase
        .from("organizations")
        .update({ settings: updatedSettings, updated_at: new Date().toISOString() })
        .eq("id", orgId);

      return NextResponse.json({ success: true, appointment: newApp });
    }

    // ── 5. PLAYER REQUEST AVAILABILITY / BOOK SLOT ──
    if (action === "request_availability" || slotId) {
      const targetDate = date || preferredDay || new Date().toISOString().split("T")[0];
      const timeSlotList: string[] = Array.isArray(selectedTimeSlots) ? selectedTimeSlots : [];
      const appReason = reason || notes || (timeSlotList.length ? `Franjas elegidas: ${timeSlotList.join(", ")}` : "Consulta de Fisioterapia");
      const schedTime = timeSlotList.length === 1 ? timeSlotList[0] : (startTime || undefined);

      const resolvedId = playerRow?.id || playerId || `p-${Date.now()}`;
      const resolvedName = playerRow
        ? (playerRow.sporting_name || `${playerRow.first_name || ""} ${playerRow.last_name || ""}`.trim())
        : (playerName || "Jugador");
      const resolvedJersey = playerRow?.player_team_memberships?.[0]?.jersey_number ?? (jerseyNumber != null ? Number(jerseyNumber) : null);

      const newApp = {
        id: `app-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        consultation_id: slotId || `cons-${targetDate}`,
        player_id: resolvedId,
        player_name: resolvedName,
        jersey_number: resolvedJersey,
        reason: appReason,
        selected_time_slots: timeSlotList,
        status: schedTime ? "scheduled" : "pending",
        scheduled_time: schedTime,
        notes: notes || (timeSlotList.length ? `Franjas elegidas: ${timeSlotList.join(", ")}` : undefined),
        date: targetDate,
        created_at: new Date().toISOString(),
      };

      // Upsert by player_id + date
      const existingIdx = appList.findIndex((a: any) => a.player_id === resolvedId && a.date === targetDate);
      if (existingIdx >= 0) {
        appList[existingIdx] = {
          ...appList[existingIdx],
          ...newApp,
        };
      } else {
        appList.push(newApp);
      }

      const updatedSettings = {
        ...existingSettings,
        physio_appointments: appList,
      };

      await supabase
        .from("organizations")
        .update({ settings: updatedSettings, updated_at: new Date().toISOString() })
        .eq("id", orgId);

      return NextResponse.json({
        success: true,
        message: "Solicitud registrada con éxito. El fisioterapeuta revisará tus horarios.",
        appointment: newApp,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
