import { createClient } from "@supabase/supabase-js";

/**
 * Supabase admin client for the Statistics_DB (Federation project).
 *
 * Uses the service role key — bypasses RLS — intended only for server-side
 * scraper scripts and API routes with appropriate authorization.
 *
 * Defer initialization to avoid crashing Next.js during build-time module evaluation
 * when environment variables might not be present.
 */

let clientInstance: any = null;

function getStatsClient() {
  if (clientInstance) return clientInstance;

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

  clientInstance = createClient(statsUrl, statsServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: (url, options) => {
        return fetch(url, {
          ...options,
          cache: "no-store",
        });
      },
    },
  });

  return clientInstance;
}

// Export a Proxy that lazy-evaluates the Supabase client when accessed
export const statsAdmin = new Proxy({} as any, {
  get(target, prop) {
    const client = getStatsClient();
    const value = client[prop];
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});

