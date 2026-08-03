import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { promises as fs } from "fs";
import path from "path";
import type { SessionVideoData } from "@/lib/clublab/types";

const DATA_FILE_PATH = path.join(process.cwd(), "src", "data", "match-video-analysis.json");

// In-memory cache for warm serverless runtime instances
const memoryStore: Record<string, SessionVideoData> = {};

/**
 * Retrieves the stored video analysis session data for a given match ID.
 * Primary store: Supabase Database (organizations table settings JSONB).
 * Fallback: Local JSON cache / memory.
 */
export async function getVideoAnalysis(matchId: string): Promise<SessionVideoData> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const cookieStore = await cookies();
      const activeOrgId = cookieStore.get("cl_active_org_id")?.value;

      let orgId = activeOrgId;
      if (!orgId) {
        const { data: userRole } = await supabase
          .from("user_organization_roles")
          .select("organization_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();
        orgId = userRole?.organization_id;
      }

      if (orgId) {
        const { data: org, error: orgErr } = await supabase
          .from("organizations")
          .select("settings")
          .eq("id", orgId)
          .single();

        if (!orgErr && org?.settings?.video_analysis?.[matchId]) {
          const loadedData = org.settings.video_analysis[matchId];
          memoryStore[matchId] = loadedData;
          return loadedData;
        }
      }
    }
  } catch (err) {
    console.warn("[videoAnalysis] Could not fetch video analysis from Supabase organizations:", err);
  }

  // Fallback 1: Warm in-memory cache
  if (memoryStore[matchId]) {
    return memoryStore[matchId];
  }

  // Fallback 2: Local JSON file (development environment)
  try {
    const content = await fs.readFile(DATA_FILE_PATH, "utf8");
    const data = JSON.parse(content);
    return data[matchId] || { general_notes: "", videos: [], montages: [], cut_bank: [] };
  } catch {
    return { general_notes: "", videos: [], montages: [], cut_bank: [] };
  }
}

/**
 * Saves video analysis session data (half timestamps, clips, montages, annotations) for a match ID.
 * Persists directly into Supabase Database under the organization's settings JSONB.
 */
export async function saveVideoAnalysis(matchId: string, videoData: SessionVideoData): Promise<void> {
  // 1. Update in-memory warm store
  memoryStore[matchId] = videoData;

  // 2. Persist to Supabase Database (organizations table)
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (!authErr && user) {
      const cookieStore = await cookies();
      const activeOrgId = cookieStore.get("cl_active_org_id")?.value;

      let orgId = activeOrgId;
      if (!orgId) {
        const { data: userRole } = await supabase
          .from("user_organization_roles")
          .select("organization_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();
        orgId = userRole?.organization_id;
      }

      if (orgId) {
        const { data: org } = await supabase
          .from("organizations")
          .select("settings")
          .eq("id", orgId)
          .single();

        const currentSettings = org?.settings || {};
        const updatedSettings = {
          ...currentSettings,
          video_analysis: {
            ...(currentSettings.video_analysis || {}),
            [matchId]: videoData
          }
        };

        const { error: updateErr } = await supabase
          .from("organizations")
          .update({ settings: updatedSettings })
          .eq("id", orgId);

        if (updateErr) {
          console.error("[videoAnalysis] Error updating Supabase settings:", updateErr);
        } else {
          console.log(`[videoAnalysis] Successfully saved video analysis for match ${matchId} to Supabase org ${orgId}`);
        }
      }
    }
  } catch (err) {
    console.error("[videoAnalysis] Exception saving to Supabase:", err);
  }

  // 3. Attempt local filesystem write (for local development only)
  try {
    const dir = path.dirname(DATA_FILE_PATH);
    await fs.mkdir(dir, { recursive: true });
    let existing: Record<string, any> = {};
    try {
      const content = await fs.readFile(DATA_FILE_PATH, "utf8");
      existing = JSON.parse(content);
    } catch {}
    existing[matchId] = videoData;
    await fs.writeFile(DATA_FILE_PATH, JSON.stringify(existing, null, 2), "utf8");
  } catch {
    // Expected on serverless Vercel environment
  }
}
