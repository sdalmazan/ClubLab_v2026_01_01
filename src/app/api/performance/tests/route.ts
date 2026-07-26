import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { data: orgRole } = await supabase
      .from("user_organization_roles")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!orgRole?.organization_id) {
      return NextResponse.json({ error: "Sin organización activa" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("activeOnly") === "true";

    let query = supabaseAdmin
      .from("physical_tests")
      .select("*")
      .order("name", { ascending: true });

    if (activeOnly) {
      query = query.eq("is_active", true);
    }

    const { data: tests, error } = await query;
    if (error) throw error;

    let resultList = Array.isArray(tests) ? [...tests] : [];

    // Ensure Antropometría ISAK Skinfold test exists in DB & response
    const hasSkinfolds = resultList.some(
      (t: any) =>
        t.id === "t-skinfolds" ||
        t.name?.toLowerCase().includes("antropometría") ||
        t.name?.toLowerCase().includes("pliegues")
    );

    if (!hasSkinfolds) {
      const skinfoldTest = {
        id: "t-skinfolds",
        name: "Antropometría — 6 Pliegues Cutáneos ISAK (% Grasa)",
        category: "Composición Corporal",
        unit: "%",
        higher_is_better: false,
        is_active: true,
        description: "Suma de 6 pliegues cutáneos (Tríceps, Subescapular, Supraespinal, Abdominal, Muslo Anterior, Pierna Medial). Cálculo de % grasa corporal Yuhasz/Faulkner."
      };

      try {
        await supabaseAdmin.from("physical_tests").upsert([skinfoldTest]);
      } catch (upsertErr) {
        console.error("Auto-upsert skinfold test error:", upsertErr);
      }

      if (!activeOnly || skinfoldTest.is_active) {
        resultList.unshift(skinfoldTest);
      }
    }

    return NextResponse.json(resultList);
  } catch (err: any) {
    console.error("GET /api/performance/tests error:", err);
    return NextResponse.json({ error: err.message || "Error al obtener tests" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { data: orgRole } = await supabase
      .from("user_organization_roles")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!orgRole?.organization_id) {
      return NextResponse.json({ error: "Sin organización activa" }, { status: 403 });
    }

    const body = await request.json();
    const { name, category, unit, higher_is_better, description } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "El nombre del test es obligatorio" }, { status: 400 });
    }

    const { data: newTest, error } = await supabaseAdmin
      .from("physical_tests")
      .insert({
        organization_id: orgRole.organization_id,
        name: name.trim(),
        category: category?.trim() || "Físico",
        unit: unit?.trim() || "unidades",
        higher_is_better: higher_is_better !== undefined ? !!higher_is_better : true,
        description: description?.trim() || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(newTest);
  } catch (err: any) {
    console.error("POST /api/performance/tests error:", err);
    return NextResponse.json({ error: err.message || "Error al crear test" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { id, is_active, name, category, unit, higher_is_better, description } = body;

    if (!id) {
      return NextResponse.json({ error: "ID de test obligatorio" }, { status: 400 });
    }

    const updatePayload: any = {};
    if (is_active !== undefined) updatePayload.is_active = !!is_active;
    if (name !== undefined) updatePayload.name = name.trim();
    if (category !== undefined) updatePayload.category = category.trim();
    if (unit !== undefined) updatePayload.unit = unit.trim();
    if (higher_is_better !== undefined) updatePayload.higher_is_better = !!higher_is_better;
    if (description !== undefined) updatePayload.description = description?.trim() || null;

    const { data: updatedTest, error } = await supabaseAdmin
      .from("physical_tests")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(updatedTest);
  } catch (err: any) {
    console.error("PUT /api/performance/tests error:", err);
    return NextResponse.json({ error: err.message || "Error al actualizar test" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID de test obligatorio" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("physical_tests")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE /api/performance/tests error:", err);
    return NextResponse.json({ error: err.message || "Error al eliminar test" }, { status: 500 });
  }
}
