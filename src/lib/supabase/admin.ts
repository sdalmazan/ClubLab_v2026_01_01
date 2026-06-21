import { createClient } from "@supabase/supabase-js";

/**
 * Supabase admin client — uses service role key.
 * ONLY for server-side operations that bypass RLS:
 * - User management
 * - Admin operations
 * - Seeding / migrations
 *
 * NEVER expose this client to the browser.
 * NEVER use in Client Components.
 */
export function createAdminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}
