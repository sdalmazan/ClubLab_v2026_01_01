import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const role = searchParams.get("role");

  if (code) {
    const supabase = await createClient();
    
    // Check if user is already logged in (e.g. from a previous redirect/request in a double-request scenario)
    const { data: { user: existingUser } } = await supabase.auth.getUser();
    if (existingUser) {
      console.log("ℹ️ User already logged in in callback, redirecting directly to:", next);
      return NextResponse.redirect(`${origin}${next}`);
    }

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("❌ Error in exchangeCodeForSession:", error.message, error);
    }
    if (!error && data?.user) {
      const currentRole = data.user.user_metadata?.role;
      if (role && !currentRole) {
        await supabase.auth.updateUser({
          data: { role }
        });
      } else if (!currentRole) {
        await supabase.auth.updateUser({
          data: { role: "club_admin" }
        });
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Return the user to an error page or login with error param
  return NextResponse.redirect(`${origin}/login?error=auth-callback-failed`);
}
