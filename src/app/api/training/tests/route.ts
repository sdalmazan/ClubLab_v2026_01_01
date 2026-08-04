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
    const date = searchParams.get("date");
    const teamId = searchParams.get("teamId");

    const adminSupabase = createAdminClient();

    let query = adminSupabase.from("physical_test_results").select("*");
    if (date) query = query.eq("date", date);
    if (teamId) query = query.eq("team_id", teamId);

    const { data: results, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ results: results || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
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
    const { teamId, date, entries } = body;

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

    // Process each test result entry
    for (const entry of entries || []) {
      const { playerId, testId, testName, unit, value } = entry;
      if (!playerId || value == null) continue;

      // 1. Ensure test exists in physical_tests
      let testRecordId = testId;
      const { data: existingTest } = await adminSupabase
        .from("physical_tests")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("name", testName)
        .limit(1)
        .maybeSingle();

      if (existingTest) {
        testRecordId = existingTest.id;
      } else {
        const { data: newTest } = await adminSupabase
          .from("physical_tests")
          .insert({
            organization_id: organizationId,
            name: testName,
            unit: unit || "",
            category: "fuerza",
          })
          .select("id")
          .single();

        if (newTest) testRecordId = newTest.id;
      }

      // 2. Insert or update result
      if (testRecordId) {
        await adminSupabase.from("physical_test_results").upsert({
          organization_id: organizationId,
          player_id: playerId,
          test_id: testRecordId,
          team_id: teamId || null,
          date: date || new Date().toISOString().split("T")[0],
          value: Number(value) || 0,
          conducted_by: user.id,
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
