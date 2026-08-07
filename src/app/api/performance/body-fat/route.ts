import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const playerId = searchParams.get("playerId");
    const teamId = searchParams.get("teamId");
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 50;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Get user's org
    const { data: userRole } = await supabase
      .from("user_organization_roles")
      .select("organization_id, team_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!userRole) {
      return NextResponse.json({ error: "Sin organización asignada" }, { status: 403 });
    }

    let query = supabase
      .from("player_body_fat_entries")
      .select("*, players(id, first_name, last_name, avatar_url, weight_kg)")
      .eq("organization_id", userRole.organization_id)
      .order("date", { ascending: false })
      .limit(limit);

    if (playerId) {
      query = query.eq("player_id", playerId);
    } else if (teamId) {
      query = query.eq("team_id", teamId);
    }

    const { data: entries, error } = await query;
    if (error) {
      console.error("Error fetching body fat entries:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If fetching for a specific player, compute percentile within the squad/team
    let squadPercentileInfo = null;
    if (playerId && entries && entries.length > 0) {
      const targetPlayerEntry = entries[0]; // Latest entry for this player
      const targetFatPct = Number(targetPlayerEntry.fat_percentage_6 || 0);

      // Fetch latest fat percentage for all players in org/team
      const { data: allPlayersLatest } = await supabase
        .from("player_body_fat_entries")
        .select("player_id, fat_percentage_6, date")
        .eq("organization_id", userRole.organization_id)
        .order("date", { ascending: false });

      if (allPlayersLatest && allPlayersLatest.length > 0) {
        // Map to get only the latest entry per player
        const latestByPlayerMap = new Map<string, number>();
        for (const entry of allPlayersLatest) {
          if (!latestByPlayerMap.has(entry.player_id)) {
            latestByPlayerMap.set(entry.player_id, Number(entry.fat_percentage_6 || 0));
          }
        }

        const fatValues = Array.from(latestByPlayerMap.values());
        const totalSquad = fatValues.length;

        // Players with higher fat % (worse/higher than this player)
        const playersWithHigherFat = fatValues.filter(f => f > targetFatPct).length;
        const playersWithEqualFat = fatValues.filter(f => f === targetFatPct).length;

        // Percentile: % of squad that has equal or higher fat percentage than this player (higher percentile = leaner than X% of squad)
        const percentile = totalSquad > 0 
          ? Math.min(99, Math.max(1, Math.round(((playersWithHigherFat + 0.5 * playersWithEqualFat) / totalSquad) * 100)))
          : 50;

        // Squad rank (1 = lowest fat % in team)
        const sortedFats = [...fatValues].sort((a, b) => a - b);
        const rank = sortedFats.indexOf(targetFatPct) + 1;

        squadPercentileInfo = {
          percentile,
          rank: rank > 0 ? rank : 1,
          totalSquad,
          teamAverageFat: Math.round((fatValues.reduce((a, b) => a + b, 0) / (totalSquad || 1)) * 10) / 10,
        };
      }
    }

    return NextResponse.json({
      entries: entries || [],
      squadPercentileInfo,
    });
  } catch (err: any) {
    console.error("GET /api/performance/body-fat error:", err);
    return NextResponse.json({ error: err.message || "Error interno del servidor" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { data: userRole } = await supabase
      .from("user_organization_roles")
      .select("organization_id, team_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!userRole) {
      return NextResponse.json({ error: "Sin organización asignada" }, { status: 403 });
    }

    const body = await request.json();
    const {
      playerId,
      teamId,
      date,
      weight_kg,
      triceps_mm = 0,
      subescapular_mm = 0,
      biceps_mm = 0,
      abdominal_mm = 0,
      iliaco_mm = 0,
      pierna_mm = 0,
      notes,
    } = body;

    if (!playerId) {
      return NextResponse.json({ error: "Falta el ID del jugador" }, { status: 400 });
    }

    // Convert values to NUMERIC
    const tri = parseFloat(triceps_mm) || 0;
    const sub = parseFloat(subescapular_mm) || 0;
    const bic = parseFloat(biceps_mm) || 0;
    const abd = parseFloat(abdominal_mm) || 0;
    const ili = parseFloat(iliaco_mm) || 0;
    const pie = parseFloat(pierna_mm) || 0;
    const weight = parseFloat(weight_kg) || null;

    // ISAK Sumatorio (6 pliegues)
    const sumatorio = Math.round((tri + sub + bic + abd + ili + pie) * 100) / 100;

    // Yuhasz Formula: % Grasa = 0.1051 * Sumatorio + 2.585
    const fat6 = Math.round((0.1051 * sumatorio + 2.585) * 100) / 100;

    // 4 Pliegues Sum (Tríceps + Subescapular + Abdominal + Ilíaco)
    const sum4 = Math.round((tri + sub + abd + ili) * 100) / 100;
    const fat4 = Math.round((0.1051 * sum4 + 2.585) * 100) / 100;

    const recordDate = date || new Date().toISOString().split("T")[0];

    const { data: newEntry, error } = await supabase
      .from("player_body_fat_entries")
      .insert({
        organization_id: userRole.organization_id,
        team_id: teamId || userRole.team_id || null,
        player_id: playerId,
        date: recordDate,
        weight_kg: weight,
        triceps_mm: tri,
        subescapular_mm: sub,
        biceps_mm: bic,
        abdominal_mm: abd,
        iliaco_mm: ili,
        pierna_mm: pie,
        sumatorio_mm: sumatorio,
        fat_percentage_6: fat6,
        fat_percentage_4: fat4,
        notes: notes ? notes.trim() : null,
        conducted_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error("Error inserting body fat entry:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Update player's weight_kg if weight is provided
    if (weight && weight > 0) {
      await supabase
        .from("players")
        .update({ weight_kg: weight, updated_at: new Date().toISOString() })
        .eq("id", playerId);
    }

    return NextResponse.json(newEntry);
  } catch (err: any) {
    console.error("POST /api/performance/body-fat error:", err);
    return NextResponse.json({ error: err.message || "Error interno del servidor" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Falta el ID del registro" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { error } = await supabase
      .from("player_body_fat_entries")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al eliminar registro" }, { status: 500 });
  }
}
