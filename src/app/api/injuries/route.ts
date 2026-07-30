import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Resolve player / org
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
      return NextResponse.json({ injuries: [] });
    }

    // 1. Fetch from DB injuries table
    const { data: dbInjuries } = await supabase
      .from("injuries")
      .select("*, players(first_name, last_name, sporting_name)")
      .eq("organization_id", orgId)
      .in("status", ["active", "readaptation"])
      .order("created_at", { ascending: false });

    // 2. Fetch from organizations.settings fallback
    const { data: org } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", orgId)
      .single();

    const settingsInjuries: any[] = org?.settings?.active_injuries || [];

    const dbMapped = (dbInjuries || []).map((i: any) => {
      const p = i.players;
      const pName = p ? (p.sporting_name || `${p.first_name || ""} ${p.last_name || ""}`.trim()) : "Jugador";
      return {
        id: i.id,
        player_id: i.player_id,
        player_name: pName,
        body_part: i.body_part || i.injury_type || "Lesión sin especificar",
        severity: i.severity || "medium",
        status: i.status || "active",
        recovery_phase: i.recovery_phase || 1,
        expected_return_date: i.expected_return_date || i.return_date || null,
        description: i.notes || i.description || "",
        reports: [],
        updated_at: i.updated_at || new Date().toISOString(),
      };
    });

    // Merge DB injuries with settings injuries
    const combinedMap = new Map();
    for (const inj of [...settingsInjuries, ...dbMapped]) {
      const key = inj.id || `${inj.player_id}-${inj.body_part}`;
      if (!combinedMap.has(key)) {
        combinedMap.set(key, inj);
      }
    }

    const injuries = Array.from(combinedMap.values());
    return NextResponse.json({ injuries });
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
    const { playerId, bodyPart, severity, recoveryPhase, expectedReturnDate, notes, playerName } = body;

    if (!playerId || !bodyPart) {
      return NextResponse.json({ error: "Faltan campos requeridos: playerId o bodyPart" }, { status: 400 });
    }

    // Resolve org & team
    const { data: player } = await supabase
      .from("players")
      .select("id, first_name, last_name, sporting_name, organization_id, team_id")
      .eq("id", playerId)
      .maybeSingle();

    const { data: orgRole } = await supabase
      .from("user_organization_roles")
      .select("organization_id, team_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const orgId = player?.organization_id || orgRole?.organization_id;
    const teamId = player?.team_id || orgRole?.team_id;

    if (!orgId) {
      return NextResponse.json({ error: "No organization found" }, { status: 400 });
    }

    const pName = playerName || (player ? (player.sporting_name || `${player.first_name || ""} ${player.last_name || ""}`.trim()) : "Jugador");
    const phase = recoveryPhase || 1;

    const newInjRecord = {
      id: `inj-${Date.now()}`,
      player_id: playerId,
      player_name: pName,
      body_part: bodyPart.trim(),
      severity: severity || "medium",
      status: phase >= 2 ? "readaptation" : "active",
      recovery_phase: phase,
      expected_return_date: expectedReturnDate || null,
      description: notes || "",
      reports: [],
      updated_at: new Date().toISOString(),
    };

    // 1. Insert into DB injuries table (Server credentials)
    try {
      await supabase.from("injuries").insert({
        organization_id: orgId,
        team_id: teamId || null,
        player_id: playerId,
        injury_type: bodyPart.trim(),
        body_part: bodyPart.trim(),
        severity: severity || "medium",
        status: phase >= 2 ? "readaptation" : "active",
        recovery_phase: phase,
        expected_return_date: expectedReturnDate || null,
        notes: notes || null,
      });
    } catch (e) {}

    // 2. Automatically update player availability_status & physical_status in players table
        const availStatus = phase === 4 ? "available" : "not_available";
        const physStatus = phase === 4 ? "green" : phase === 3 ? "yellow" : "red";
    const availNotes = phase === 4 ? null : `${bodyPart.trim()} (Fase ${phase})`;

    try {
      await supabase
        .from("players")
        .update({
          availability_status: availStatus,
          physical_status: physStatus,
          availability_notes: availNotes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", playerId);
    } catch (e) {}

    // 3. Persist in organizations.settings JSONB column (100% durable)
    const { data: org } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", orgId)
      .single();

    const existingSettings = org?.settings || {};
    let activeInjuries: any[] = Array.isArray(existingSettings.active_injuries) ? [...existingSettings.active_injuries] : [];
    activeInjuries = [newInjRecord, ...activeInjuries.filter((i: any) => i.id !== newInjRecord.id)];

    const updatedSettings = {
      ...existingSettings,
      active_injuries: activeInjuries,
    };

    await supabase
      .from("organizations")
      .update({ settings: updatedSettings, updated_at: new Date().toISOString() })
      .eq("id", orgId);

    return NextResponse.json({ success: true, injury: newInjRecord });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { injuryId, recoveryPhase, expectedReturnDate, status, playerId } = body;

    if (!injuryId) {
      return NextResponse.json({ error: "Falta injuryId" }, { status: 400 });
    }

    const { data: userRole } = await supabase
      .from("user_organization_roles")
      .select("organization_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: player } = await supabase
      .from("players")
      .select("organization_id")
      .or(`user_id.eq.${user.id},email.eq.${user.email}`)
      .maybeSingle();

    const orgId = player?.organization_id || userRole?.organization_id;

    if (orgId) {
      const phase = recoveryPhase ?? 1;
      const injStatus = status || (phase >= 2 ? "readaptation" : "active");

      // 1. Update DB injuries table
      try {
        await supabase
          .from("injuries")
          .update({
            recovery_phase: phase,
            expected_return_date: expectedReturnDate || null,
            status: injStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("id", injuryId);
      } catch (e) {}

      // 2. Update organizations.settings JSONB column
      const { data: org } = await supabase
        .from("organizations")
        .select("settings")
        .eq("id", orgId)
        .single();

      const existingSettings = org?.settings || {};
      let activeInjuries: any[] = Array.isArray(existingSettings.active_injuries) ? [...existingSettings.active_injuries] : [];

      let targetPlayerId = playerId;
      activeInjuries = activeInjuries.map((inj: any) => {
        if (inj.id === injuryId || (inj.player_id && inj.player_id === playerId)) {
          targetPlayerId = inj.player_id || targetPlayerId;
          return {
            ...inj,
            recovery_phase: phase,
            expected_return_date: expectedReturnDate ?? inj.expected_return_date,
            status: injStatus,
            updated_at: new Date().toISOString(),
          };
        }
        return inj;
      });

      // 3. Automatically update player availability_status & physical_status in players table
      if (targetPlayerId) {
        const availStatus = phase === 4 ? "available" : "not_available";
        const physStatus = phase === 4 ? "green" : phase === 3 ? "yellow" : "red";

        try {
          await supabase
            .from("players")
            .update({
              availability_status: availStatus,
              physical_status: physStatus,
              updated_at: new Date().toISOString(),
            })
            .eq("id", targetPlayerId);
        } catch (e) {}
      }

      const updatedSettings = {
        ...existingSettings,
        active_injuries: activeInjuries,
      };

      await supabase
        .from("organizations")
        .update({ settings: updatedSettings, updated_at: new Date().toISOString() })
        .eq("id", orgId);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
