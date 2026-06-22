/**
 * ClubLab — Supabase connection test
 * Run with: node scripts/check-db.mjs
 */
import { readFileSync } from "fs";
import { resolve } from "path";

// Parse .env.local manually
const envPath = resolve(process.cwd(), ".env.local");
const envContent = readFileSync(envPath, "utf-8");
const env = {};
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const val = trimmed.slice(eqIdx + 1).trim();
  env[key] = val;
}

const SUPABASE_URL = env["NEXT_PUBLIC_SUPABASE_URL"]?.trim();
const SERVICE_KEY = env["SUPABASE_SERVICE_ROLE_KEY"]?.trim();

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const tables = [
  "organizations", "plans", "features", "subscriptions",
  "clubs", "seasons", "teams", "user_organization_roles",
  "players", "player_team_memberships", "training_sessions",
  "wellness_entries", "rpe_entries", "alerts", "injuries", "matches",
];

async function checkTable(table) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?select=count&limit=0`,
    {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: "count=exact",
      },
    }
  );
  return res.ok;
}

async function main() {
  console.log(`\n🔍 Checking Supabase: ${SUPABASE_URL}\n`);

  let ok = 0;
  let fail = 0;

  for (const table of tables) {
    const exists = await checkTable(table);
    if (exists) {
      console.log(`  ✅  ${table}`);
      ok++;
    } else {
      console.log(`  ❌  ${table} — NOT FOUND (migration missing?)`);
      fail++;
    }
  }

  const plansRes = await fetch(`${SUPABASE_URL}/rest/v1/plans?select=slug`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  const plans = plansRes.ok ? await plansRes.json() : [];
  const planSlugs = Array.isArray(plans) ? plans.map((p) => p.slug) : [];
  console.log(`\n📋 Plans seeded: ${planSlugs.join(", ") || "NONE — run 003_seed_plans.sql"}`);

  console.log(
    `\n${fail === 0 ? "✅ All tables present — ready for Phase 4!" : `⚠️  ${fail} tables missing`} (${ok}/${tables.length})\n`
  );

  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error("Error:", e.message); process.exit(1); });
