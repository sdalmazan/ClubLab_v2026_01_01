import { createClient } from "@supabase/supabase-js";

/**
 * Supabase admin client for the Statistics_DB (Federation project).
 *
 * Uses the service role key — bypasses RLS — intended only for server-side
 * scraper scripts and API routes with appropriate authorization.
 *
 * Environment variables:
 *   NEXT_PUBLIC_FEDERATION_SUPABASE_URL       — public project URL
 *   FEDERATION_SUPABASE_SERVICE_ROLE_KEY      — secret service role key
 */

const statsUrl = process.env.NEXT_PUBLIC_FEDERATION_SUPABASE_URL;
const statsServiceRoleKey = process.env.FEDERATION_SUPABASE_SERVICE_ROLE_KEY;

if (!statsUrl) {
  throw new Error(
    "Missing environment variable: NEXT_PUBLIC_FEDERATION_SUPABASE_URL"
  );
}

if (!statsServiceRoleKey) {
  throw new Error(
    "Missing environment variable: FEDERATION_SUPABASE_SERVICE_ROLE_KEY"
  );
}

export const statsAdmin = createClient(statsUrl, statsServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
