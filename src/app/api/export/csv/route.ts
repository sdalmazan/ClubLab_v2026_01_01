import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "master";
    const teamId = searchParams.get("teamId");

    const adminSupabase = createAdminClient();

    const { data: orgRole } = await adminSupabase
      .from("user_organization_roles")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    const organizationId = orgRole?.organization_id;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization found" }, { status: 400 });
    }

    // Fetch Players
    let pQuery = adminSupabase.from("players").select("id, first_name, last_name, sporting_name, jersey_number, primary_position");
    if (teamId) pQuery = pQuery.eq("team_id", teamId);
    const { data: players } = await pQuery;
    const playersMap = new Map((players || []).map((p) => [p.id, p]));

    let csvHeader = "";
    let csvRows: string[] = [];

    if (type === "wellness") {
      const { data: wellness } = await adminSupabase
        .from("player_wellness_checkins")
        .select("*")
        .order("date", { ascending: false });

      csvHeader = "Fecha;Dorsal;Nombre Deportivo;Nombre Completo;Calidad Sueño (1-5);Fatiga (1-5);Ánimo (1-5);Dolor Muscular (1-5);Estrés (1-5);Peso (kg);Molestia Anatomica;Comentarios";
      csvRows = (wellness || []).map((w) => {
        const p = playersMap.get(w.player_id);
        const pName = p?.sporting_name || `${p?.first_name || ""} ${p?.last_name || ""}`.trim() || "Jugador";
        const fullName = `${p?.first_name || ""} ${p?.last_name || ""}`.trim();
        return [
          w.date,
          p?.jersey_number ?? "",
          `"${pName}"`,
          `"${fullName}"`,
          w.sleep_quality ?? "",
          w.fatigue ?? "",
          w.mood ?? "",
          w.muscle_soreness ?? w.soreness ?? "",
          w.stress ?? "",
          w.weight_kg ?? "",
          `"${w.discomfort_body_part || ""}"`,
          `"${(w.comments || "").replace(/"/g, '""')}"`,
        ].join(";");
      });
    } else if (type === "rpe") {
      const { data: rpeData } = await adminSupabase
        .from("rpe_entries")
        .select("*, training_sessions(title)")
        .order("date", { ascending: false });

      csvHeader = "Fecha;Dorsal;Nombre Deportivo;Nombre Completo;Sesion;Esfuerzo RPE (1-10);Sensacion Post;Notas";
      csvRows = (rpeData || []).map((r) => {
        const p = playersMap.get(r.player_id);
        const pName = p?.sporting_name || `${p?.first_name || ""} ${p?.last_name || ""}`.trim() || "Jugador";
        const fullName = `${p?.first_name || ""} ${p?.last_name || ""}`.trim();
        const sTitle = (r.training_sessions as any)?.title || "Sesión Entreno";
        return [
          r.date,
          p?.jersey_number ?? "",
          `"${pName}"`,
          `"${fullName}"`,
          `"${sTitle}"`,
          r.rpe ?? "",
          `"${r.post_feeling || ""}"`,
          `"${(r.notes || "").replace(/"/g, '""')}"`,
        ].join(";");
      });
    } else if (type === "tests") {
      const { data: testsData } = await adminSupabase
        .from("physical_test_results")
        .select("*, physical_tests(name, unit)")
        .order("date", { ascending: false });

      csvHeader = "Fecha;Dorsal;Nombre Deportivo;Nombre Completo;Test;Valor;Unidad;Notas";
      csvRows = (testsData || []).map((t) => {
        const p = playersMap.get(t.player_id);
        const pName = p?.sporting_name || `${p?.first_name || ""} ${p?.last_name || ""}`.trim() || "Jugador";
        const fullName = `${p?.first_name || ""} ${p?.last_name || ""}`.trim();
        const testName = (t.physical_tests as any)?.name || "Test";
        const unit = (t.physical_tests as any)?.unit || "";
        return [
          t.date,
          p?.jersey_number ?? "",
          `"${pName}"`,
          `"${fullName}"`,
          `"${testName}"`,
          t.value ?? "",
          `"${unit}"`,
          `"${(t.notes || "").replace(/"/g, '""')}"`,
        ].join(";");
      });
    } else if (type === "injuries") {
      const { data: injuries } = await adminSupabase
        .from("injuries")
        .select("*")
        .order("created_at", { ascending: false });

      csvHeader = "ID Jugador;Dorsal;Nombre Deportivo;Nombre Completo;Tipo Lesion;Zona Anatomica;Gravedad;Fecha Lesion;Fecha Alta Estimada;Estado Actual";
      csvRows = (injuries || []).map((inj) => {
        const p = playersMap.get(inj.player_id);
        const pName = p?.sporting_name || `${p?.first_name || ""} ${p?.last_name || ""}`.trim() || "Jugador";
        const fullName = `${p?.first_name || ""} ${p?.last_name || ""}`.trim();
        return [
          inj.player_id,
          p?.jersey_number ?? "",
          `"${pName}"`,
          `"${fullName}"`,
          `"${inj.injury_type || ""}"`,
          `"${inj.body_part || ""}"`,
          `"${inj.severity || ""}"`,
          inj.injury_date || "",
          inj.expected_return_date || "",
          `"${inj.status || ""}"`,
        ].join(";");
      });
    } else {
      // MASTER AGGREGATED CSV
      const { data: wellness } = await adminSupabase.from("player_wellness_checkins").select("*");
      const { data: rpeData } = await adminSupabase.from("rpe_entries").select("*");
      const { data: testsData } = await adminSupabase.from("physical_test_results").select("*, physical_tests(name, unit)");

      csvHeader = "Fecha;Dorsal;Nombre Deportivo;Nombre Completo;Posicion;Sueño (1-5);Fatiga (1-5);Dolor Muscular (1-5);Peso (kg);RPE Post-Entreno (1-10);Resumen Tests Físicos";

      // Group by player_id and date
      const dateMap = new Map<string, any>();
      (wellness || []).forEach((w) => {
        const key = `${w.date}_${w.player_id}`;
        if (!dateMap.has(key)) dateMap.set(key, { date: w.date, playerId: w.player_id });
        const item = dateMap.get(key);
        item.wellness = w;
      });

      (rpeData || []).forEach((r) => {
        const key = `${r.date}_${r.player_id}`;
        if (!dateMap.has(key)) dateMap.set(key, { date: r.date, playerId: r.player_id });
        const item = dateMap.get(key);
        item.rpe = r;
      });

      (testsData || []).forEach((t) => {
        const key = `${t.date}_${t.player_id}`;
        if (!dateMap.has(key)) dateMap.set(key, { date: t.date, playerId: t.player_id });
        const item = dateMap.get(key);
        if (!item.tests) item.tests = [];
        item.tests.push(t);
      });

      csvRows = Array.from(dateMap.values()).map((row) => {
        const p = playersMap.get(row.playerId);
        const pName = p?.sporting_name || `${p?.first_name || ""} ${p?.last_name || ""}`.trim() || "Jugador";
        const fullName = `${p?.first_name || ""} ${p?.last_name || ""}`.trim();
        const w = row.wellness || {};
        const r = row.rpe || {};
        const testSummary = (row.tests || []).map((t: any) => `${t.physical_tests?.name || "Test"}: ${t.value}${t.physical_tests?.unit || ""}`).join(" | ");

        return [
          row.date,
          p?.jersey_number ?? "",
          `"${pName}"`,
          `"${fullName}"`,
          `"${p?.primary_position || ""}"`,
          w.sleep_quality ?? "",
          w.fatigue ?? "",
          w.muscle_soreness ?? w.soreness ?? "",
          w.weight_kg ?? "",
          r.rpe ?? "",
          `"${testSummary.replace(/"/g, '""')}"`,
        ].join(";");
      });
    }

    const csvContent = "\uFEFF" + [csvHeader, ...csvRows].join("\n");

    return new Response(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="ClubLab_Export_${type}.csv"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
