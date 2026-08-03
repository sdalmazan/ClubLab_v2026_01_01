import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://clublab.vercel.app";

  if (!token) {
    return NextResponse.redirect(`${appBaseUrl}/login?error=token-invalido`);
  }

  try {
    const adminSupabase = createAdminClient();

    const { data: inv, error } = await adminSupabase
      .from("player_invitations")
      .select("*")
      .eq("token", token)
      .eq("role", "email_change_confirm")
      .eq("status", "pending")
      .maybeSingle();

    if (error || !inv) {
      return NextResponse.redirect(`${appBaseUrl}/login?error=token-expirado-o-usado`);
    }

    const { userId, oldEmail, newEmail } = inv.metadata || {};

    if (userId && newEmail) {
      // 1. Update email in Supabase Auth user via Admin client
      await adminSupabase.auth.admin.updateUserById(userId, {
        email: newEmail,
        email_confirm: true,
      });

      // 2. Update email in players table for this user
      await adminSupabase
        .from("players")
        .update({
          email: newEmail,
          email_verified: true,
          email_verified_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      // 3. Mark token as accepted
      await adminSupabase
        .from("player_invitations")
        .update({
          status: "accepted",
          accepted_at: new Date().toISOString(),
        })
        .eq("id", inv.id);

      return NextResponse.redirect(`${appBaseUrl}/login?message=correo-desvinculado-exito`);
    }

    return NextResponse.redirect(`${appBaseUrl}/login?error=error-actualizacion`);
  } catch (err: any) {
    console.error("Error in email change confirm:", err);
    return NextResponse.redirect(`${appBaseUrl}/login?error=error-servidor`);
  }
}
