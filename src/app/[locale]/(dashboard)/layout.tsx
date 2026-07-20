import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { LanguageSelector } from "@/components/layout/LanguageSelector";
import { HeaderContextSelector } from "@/components/layout/HeaderContextSelector";
import { BottomNavBar } from "@/components/layout/BottomNavBar";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { unstable_cache } from "next/cache";
import type { AuthUser } from "@/types";
import { findClosestValidatedColor } from "@/lib/colors";
import { PageTracker } from "@/components/layout/PageTracker";
import { CACHE_TAGS } from "@/features/analysis/cache/layer";

/**
 * Dashboard layout.
 * - Verifies Supabase auth session
 * - Loads user's organization and role
 * - Injects club branding as semantic CSS variables (no Tailwind class overrides)
 * - Renders sidebar (desktop) + bottom nav bar (mobile) + main content area
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // Get authenticated user
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  /**
   * Cached context loader — avoids 3 sequential DB queries on every page navigation.
   * TTL: 120s per user. Invalidate via invalidateUserContext(userId) on role/team changes.
   * The userId is part of the cache key, ensuring per-user isolation.
   * Uses createAdminClient() to avoid cookies() inside unstable_cache().
   */
  const getLayoutContext = unstable_cache(
    async (userId: string) => {
      const sb = createAdminClient();

      const { data: orgRole } = await sb
        .from("user_organization_roles")
        .select(`
          role,
          team_id,
          organization_id,
          organizations (
            name,
            slug,
            type,
            subscriptions (
              plans ( slug )
            )
          )
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(1)
        .single();

      if (!orgRole) {
        return { orgRole: null, teams: [], seasons: [] };
      }

      // Explicitly query clubs under this organization to build a security sandbox
      const { data: clubs } = await sb
        .from("clubs")
        .select("id")
        .eq("organization_id", orgRole.organization_id);

      const clubIds = clubs?.map((c: any) => c.id) || [];

      let teams: any[] = [];
      let seasons: any[] = [];

      if (clubIds.length > 0) {
        const { data: teamsData } = await sb
          .from("teams")
          .select("id, name, category, season_id")
          .in("club_id", clubIds)
          .order("created_at", { ascending: true });
        teams = teamsData ?? [];

        const { data: seasonsData } = await sb
          .from("seasons")
          .select("id, name, is_active")
          .in("club_id", clubIds)
          .order("name", { ascending: false });
        seasons = seasonsData ?? [];
      }

      return { orgRole, teams, seasons };
    },
    ["dashboard-layout-context"],
    {
      tags: [CACHE_TAGS.userContext(user!.id)],
      revalidate: 120, // 2 minutes — role changes visible within this window
    }
  );

  const { orgRole, teams: teamList, seasons: seasonList } = await getLayoutContext(user!.id);

  // If no org role, redirect to onboarding
  if (!orgRole) {
    redirect("/onboarding");
  }

  // Fetch organization settings separately (non-cached to prevent > 2MB layout context caching errors)
  const { data: orgSettingsData } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", orgRole.organization_id)
    .single();
  const orgSettings = orgSettingsData?.settings as any;

  const org = (orgRole as any).organizations;
  const orgType = org?.type ?? "club";
  const plan = org?.subscriptions?.[0]?.plans?.slug ?? "free";

  // Custom branding variables
  const clubName = orgSettings?.club_name ?? org?.name ?? "ClubLab";
  const clubLogoUrl = orgSettings?.club_logo_url ?? "";
  const rawPrimary = orgSettings?.club_primary_color ?? "";
  const rawSecondary = orgSettings?.club_secondary_color ?? "";
  const clubPrimaryColor = rawPrimary ? findClosestValidatedColor(rawPrimary) : "";
  const clubSecondaryColor = rawSecondary ? findClosestValidatedColor(rawSecondary) : "";

  /**
   * WCAG 2.1 relative luminance helper.
   */
  const getLuminance = (hex: string): number => {
    const h = hex.replace("#", "");
    if (h.length !== 6) return 0.5;
    const toLinear = (c: number) => {
      const s = c / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    const r = toLinear(parseInt(h.substring(0, 2), 16));
    const g = toLinear(parseInt(h.substring(2, 4), 16));
    const b = toLinear(parseInt(h.substring(4, 6), 16));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  /**
   * A color is "extreme" when it is near-black (<0.03) or near-white (>0.85).
   * Extreme colors produce invisible/washed-out UI on the dark app background.
   */
  const isExtreme = (color: string) => {
    if (!color) return true;
    const L = getLuminance(color);
    return L < 0.03 || L > 0.85;
  };

  /**
   * Smart effective accent color.
   * 1. Use club primary if it is not extreme.
   * 2. Else try secondary color.
   * 3. Else fall back to ClubLab emerald green.
   * This ensures UI elements are always visible regardless of the club's color choice.
   */
  const CLUBLAB_FALLBACK = "#10b981";
  let effectivePrimary = clubPrimaryColor || CLUBLAB_FALLBACK;
  if (isExtreme(effectivePrimary)) {
    if (clubSecondaryColor && !isExtreme(clubSecondaryColor)) {
      effectivePrimary = clubSecondaryColor;
    } else {
      effectivePrimary = CLUBLAB_FALLBACK;
    }
  }

  const effectiveLuminance = getLuminance(effectivePrimary);
  const effectiveForeground = effectiveLuminance > 0.179 ? "#0f172a" : "#ffffff";
  const effectiveIsDark = effectiveLuminance < 0.05;

  /**
   * Branding CSS: only semantic variables are set — no Tailwind utility class overrides.
   * --primary is always the effective (non-extreme) accent so UI is always visible.
   * --primary-raw preserves the original club choice for reference.
   */
  const brandingCss = `
    :root {
      --primary: ${effectivePrimary};
      --primary-foreground: ${effectiveForeground};
      --ring: ${effectivePrimary};
      --sidebar-primary: ${effectivePrimary};
      --sidebar-ring: ${effectivePrimary};
      --sidebar-primary-foreground: ${effectiveForeground};
      ${clubSecondaryColor && !isExtreme(clubSecondaryColor) && clubSecondaryColor !== effectivePrimary ? `--accent: ${clubSecondaryColor};` : ""}
      ${effectiveIsDark ? "--primary-border-boost: rgba(255,255,255,0.2);" : ""}
      --primary-raw: ${clubPrimaryColor || effectivePrimary};
    }
  `;


  const cookieStore = await cookies();
  let activeTeamId: string = cookieStore.get("cl_active_team_id")?.value ?? "";
  let activeSeasonId: string = cookieStore.get("cl_active_season_id")?.value ?? "";

  let activeTeam = teamList.find((t) => t.id === activeTeamId);
  if (!activeTeam || orgType === "club") {
    activeTeam = teamList.find((t) => t.id === orgRole.team_id) ?? teamList[0] ?? null;
    activeTeamId = activeTeam?.id ?? "";
  }

  let activeSeason = seasonList.find((s) => s.id === activeSeasonId);
  if (!activeSeason) {
    activeSeason = seasonList.find((s) => s.id === activeTeam?.season_id) ?? seasonList.find((s) => s.is_active) ?? seasonList[0] ?? null;
    activeSeasonId = activeSeason?.id ?? "";
  }

  const authUser: AuthUser = {
    id: user.id,
    email: user.email ?? "",
    organization_id: orgRole.organization_id,
    organization_slug: org?.slug ?? "",
    role: orgRole.role,
    team_id: activeTeamId || null,
    plan_slug: plan,
    club_name: clubName,
    club_logo_url: clubLogoUrl,
    club_primary_color: clubPrimaryColor,
    club_secondary_color: clubSecondaryColor,
  };




  return (
    <SidebarProvider>
      <PageTracker />
      {brandingCss && (
        <style dangerouslySetInnerHTML={{ __html: brandingCss }} />
      )}
      {org?.settings?.custom_positions && (
        <script
          dangerouslySetInnerHTML={{
            __html: `window.cl_custom_positions = ${JSON.stringify(org.settings.custom_positions)};`,
          }}
        />
      )}
      {org?.settings?.formation_coordinates && (
        <script
          dangerouslySetInnerHTML={{
            __html: `window.cl_formation_coordinates = ${JSON.stringify(org.settings.formation_coordinates)};`,
          }}
        />
      )}
      {/* Sidebar — desktop only (md and above) */}
      <AppSidebar user={authUser} />
      <SidebarInset>
        {/* Top header */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.06] bg-[rgb(6_8_20)] px-4 sticky top-0 z-40">
          {/* Sidebar trigger — hidden on mobile (BottomNavBar handles mobile nav) */}
          <SidebarTrigger className="hidden md:flex text-slate-400 hover:text-white transition-colors" />
          <div className="hidden md:block h-4 w-px bg-white/10" />

          <HeaderContextSelector
            teams={teamList}
            seasons={seasonList}
            activeTeamId={activeTeamId}
            activeSeasonId={activeSeasonId}
            orgType={orgType}
          />

          <div className="flex-1" />
          <LanguageSelector />
        </header>

        {/* Page content — responsive padding + bottom space for mobile nav */}
        <main className="flex flex-1 flex-col gap-0 p-4 sm:p-6 pb-24 sm:pb-6 min-h-[calc(100vh-3.5rem)]">
          {children}
        </main>
      </SidebarInset>

      {/* Bottom navigation — mobile only */}
      <BottomNavBar user={authUser} />
    </SidebarProvider>
  );
}
