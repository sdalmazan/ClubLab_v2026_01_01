import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import { sendPlayerInvitationEmail } from "../src/lib/email/mailer";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE env vars");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  console.log("=== Re-sending Invitation Email to Hugo Jiménez ===");

  const email = "hugojimenezgarcia10@gmail.com";
  const fullName = "Hugo Jiménez";

  // Check if invitation exists in DB
  const { data: existingInv } = await supabaseAdmin
    .from("player_invitations")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  let token = existingInv?.token;
  let orgId = existingInv?.organization_id;

  if (!orgId) {
    const { data: orgs } = await supabaseAdmin.from("organizations").select("id").limit(1);
    orgId = orgs?.[0]?.id;
  }

  if (!token) {
    token = crypto.randomUUID();
    await supabaseAdmin.from("player_invitations").insert({
      organization_id: orgId,
      email: email,
      full_name: fullName,
      role: "player",
      token: token,
      status: "pending",
    });
  } else {
    // Refresh status to pending
    await supabaseAdmin
      .from("player_invitations")
      .update({ status: "pending" })
      .eq("id", existingInv.id);
  }

  const appBaseUrl = "https://clublab.vercel.app";
  const inviteUrl = `${appBaseUrl}/invite?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

  console.log(`Sending invitation email to ${email}...`);
  console.log(`Invite link: ${inviteUrl}`);

  const sent = await sendPlayerInvitationEmail({
    to: email,
    playerName: fullName,
    clubName: "S.D. Almazán",
    inviteUrl: inviteUrl,
    token: token,
  });

  if (sent) {
    console.log("SUCCESS: Invitation email re-sent to Hugo Jiménez!");
  } else {
    console.log("EMAIL ATTEMPT COMPLETE. Check logs if SMTP is configured.");
  }
}

main().catch(console.error);
