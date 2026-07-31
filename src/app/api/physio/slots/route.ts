import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dispatchClubNotification } from "@/lib/notifications/router";
import { sendEmailAlert } from "@/lib/email/mailer";

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

    // Query squad players to enrich player names & jersey numbers
    const { data: squadPlayers } = await supabase
      .from("players")
      .select(`
        id,
        first_name,
        last_name,
        sporting_name,
        player_team_memberships(jersey_number)
      `)
      .eq("organization_id", orgId);

    const playerMap = new Map<string, { name: string; jersey: number | null }>();
    if (squadPlayers) {
      for (const p of squadPlayers) {
        const name = p.sporting_name || `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Jugador";
        const jersey = (p.player_team_memberships as any)?.[0]?.jersey_number ?? null;
        playerMap.set(p.id, { name, jersey });
      }
    }

    // Filter active open consultations
    let activeOpenCons = consList.filter((c: any) => c && c.isOpen !== false);

    if (dateParam) {
      activeOpenCons = activeOpenCons.filter((c: any) => c.date === dateParam || c.date === todayStr);
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
    let rawAppList: any[] = Array.isArray(settings.physio_appointments) ? [...settings.physio_appointments] : [];

    // Also synthesize any consultation bookings into appointments list if not present
    for (const cons of activeOpenCons) {
      const bookings = cons.bookings || [];
      for (const b of bookings) {
        const pId = b.playerId || b.player_id;
        if (pId && !rawAppList.some((a: any) => a.player_id === pId && (a.date === cons.date || !a.date))) {
          const pInfo = playerMap.get(pId);
          rawAppList.push({
            id: b.id || `app-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            consultation_id: cons.id,
            player_id: pId,
            player_name: b.playerName || pInfo?.name || "Jugador",
            jersey_number: b.jerseyNumber ?? pInfo?.jersey ?? null,
            reason: b.notes || b.reason || "Consulta Fisioterapia",
            status: "pending",
            scheduled_time: b.scheduledTime || undefined,
            date: cons.date || todayStr,
            created_at: b.createdAt || new Date().toISOString(),
          });
        }
      }
    }

    // Normalize dates (e.g. non-ISO strings like "Viernes" -> todayStr) and enrich player info
    const appList = rawAppList.map((a: any) => {
      const normalizedDate = (!a.date || !a.date.includes("-")) ? todayStr : a.date;
      const pInfo = playerMap.get(a.player_id);

      return {
        ...a,
        date: normalizedDate,
        player_name: (a.player_name && a.player_name !== "Jugador") ? a.player_name : (pInfo?.name || a.player_name || "Jugador"),
        jersey_number: a.jersey_number ?? pInfo?.jersey ?? null,
      };
    });

    let filteredAppList = appList;
    if (dateParam) {
      filteredAppList = appList.filter((a: any) => a.date === dateParam || a.date === todayStr);
    }

    return NextResponse.json({ slots: formattedSlots, appointments: filteredAppList });
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
        const prevApp = appList[idx];
        const hasNewTime = scheduled_time && scheduled_time !== prevApp.scheduled_time;

        appList[idx] = {
          ...prevApp,
          scheduled_time: scheduled_time !== undefined ? scheduled_time : prevApp.scheduled_time,
          status: status !== undefined ? status : prevApp.status,
          fitness_result: fitness_result !== undefined ? fitness_result : prevApp.fitness_result,
          notes: notes !== undefined ? notes : prevApp.notes,
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

        // Notify player when time is assigned or changed
        if (hasNewTime || (scheduled_time && status === "scheduled")) {
          const targetPlayerId = appList[idx].player_id;
          const targetPlayerName = appList[idx].player_name || "Jugador";
          const appDate = appList[idx].date || new Date().toISOString().split("T")[0];
          const assignedTime = appList[idx].scheduled_time;

          // 1. App/WhatsApp notification
          try {
            await dispatchClubNotification({
              playerId: targetPlayerId,
              title: "📅 Hora de Cita con Fisioterapeuta Asignada",
              body: `Hola ${targetPlayerName}, el fisioterapeuta ha asignado/confirmado tu hora de cita para la consulta del ${appDate} a las ${assignedTime}h.`,
              actionUrl: "/player",
              actionText: "Ver Cita en App",
            });
          } catch (e) {
            console.error("Error dispatching app notification:", e);
          }

          // 2. Direct Email notification as explicitly requested
          try {
            const { data: pRow } = await supabase
              .from("players")
              .select("email, first_name, last_name")
              .eq("id", targetPlayerId)
              .maybeSingle();

            if (pRow?.email) {
              await sendEmailAlert({
                to: pRow.email,
                recipientName: targetPlayerName || `${pRow.first_name || ""} ${pRow.last_name || ""}`.trim(),
                title: "📅 Confirmación de Cita de Fisioterapia",
                body: `El fisioterapeuta del club ha asignado la hora definitiva para tu cita de fisioterapia:\n\n• Fecha: ${appDate}\n• Hora asignada: ${assignedTime}h\n• Estado: Cita Confirmada\n\nPor favor, preséntate a la hora indicadada en el área médica/fisioterapia del club.`,
                actionUrl: "/player",
                actionText: "Ver Cita en ClubLab",
              });
            }
          } catch (e) {
            console.error("Error sending physio email alert:", e);
          }
        }

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

      if (scheduled_time && playerId) {
        try {
          await dispatchClubNotification({
            playerId,
            title: "📅 Nueva Cita de Fisioterapia Programada",
            body: `Hola ${playerName}, se ha programado tu cita de fisioterapia para el ${targetDate} a las ${scheduled_time}h.`,
            actionUrl: "/player",
            actionText: "Ver Cita",
          });

          const { data: pRow } = await supabase
            .from("players")
            .select("email")
            .eq("id", playerId)
            .maybeSingle();

          if (pRow?.email) {
            await sendEmailAlert({
              to: pRow.email,
              recipientName: playerName,
              title: "📅 Nueva Cita de Fisioterapia",
              body: `El fisioterapeuta del club ha programado tu cita:\n\n• Fecha: ${targetDate}\n• Hora: ${scheduled_time}h`,
              actionUrl: "/player",
              actionText: "Ver Cita en ClubLab",
            });
          }
        } catch (e) {}
      }

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
