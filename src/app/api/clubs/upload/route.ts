import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user organization role
    const { data: orgRole } = await supabase
      .from("user_organization_roles")
      .select("organization_id, role")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!orgRole) {
      return NextResponse.json({ error: "No organization associated with this user" }, { status: 400 });
    }

    // Check permissions
    const allowedRoles = ["super_admin", "club_admin", "head_coach"];
    if (!allowedRoles.includes(orgRole.role)) {
      return NextResponse.json({ error: "Forbidden: Insufficient permissions" }, { status: 403 });
    }

    const orgId = orgRole.organization_id;

    // Parse formData
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Validate type is image
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "File must be an image" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Get extension
    const originalName = file.name || "logo.png";
    const extension = originalName.split(".").pop() || "png";
    const cleanExtension = extension.toLowerCase();

    // Create target directory in public/uploads/clubs
    const targetDir = join(process.cwd(), "public", "uploads", "clubs");
    await mkdir(targetDir, { recursive: true });

    // Name the file orgId.extension to avoid duplicate files for same club
    const fileName = `${orgId}.${cleanExtension}`;
    const filePath = join(targetDir, fileName);

    await writeFile(filePath, buffer);

    // Return the relative URL to access it in Next.js (from public folder)
    const logoUrl = `/uploads/clubs/${fileName}`;

    return NextResponse.json({ logoUrl });
  } catch (err: any) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
