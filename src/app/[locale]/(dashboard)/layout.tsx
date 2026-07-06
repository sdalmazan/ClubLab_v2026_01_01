import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { LanguageSelector } from "@/components/layout/LanguageSelector";
import { HeaderContextSelector } from "@/components/layout/HeaderContextSelector";
import { BottomNavBar } from "@/components/layout/BottomNavBar";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { AuthUser } from "@/types";
import { findClosestValidatedColor } from "@/lib/colors";
import { PageTracker } from "@/components/layout/PageTracker";

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

  // Load user's organization role
  const { data: orgRole } = await supabase
    .from("user_organization_roles")
    .select(`
      role,
      team_id,
      organization_id,
      organizations (
        name,
        slug,
        type,
        settings,
        subscriptions (
          plans ( slug )
        )
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  // If no org role, redirect to onboarding
  if (!orgRole) {
    redirect("/onboarding");
  }

  const org = (orgRole as any).organizations;
  const orgType = org?.type ?? "club";
  const plan = org?.subscriptions?.[0]?.plans?.slug ?? "free";

  // Custom branding variables
  const clubName = org?.settings?.club_name ?? org?.name ?? "ClubLab";
  const clubLogoUrl = org?.settings?.club_logo_url ?? "";
  const rawPrimary = org?.settings?.club_primary_color ?? "";
  const rawSecondary = org?.settings?.club_secondary_color ?? "";
  const clubPrimaryColor = rawPrimary ? findClosestValidatedColor(rawPrimary) : "";
  const clubSecondaryColor = rawSecondary ? findClosestValidatedColor(rawSecondary) : "";

  /**
   * WCAG 2.1 relative luminance formula for accurate contrast detection.
   * Returns 'dark' when text should be dark (light background), 'light' otherwise.
   */
  let primaryForeground = "#ffffff";
  let isDark = false;

  if (clubPrimaryColor) {
    const hex = clubPrimaryColor.replace("#", "");
    if (hex.length === 6) {
      const toLinear = (c: number) => {
        const s = c / 255;
        return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      const r = toLinear(parseInt(hex.substring(0, 2), 16));
      const g = toLinear(parseInt(hex.substring(2, 4), 16));
      const b = toLinear(parseInt(hex.substring(4, 6), 16));
      const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      // WCAG threshold: foreground is dark when luminance > 0.179
      primaryForeground = L > 0.179 ? "#0f172a" : "#ffffff";
      isDark = L < 0.05;
    }
  }

  // Fetch teams and seasons under active organization (RLS automatically isolates them)
  const { data: teams } = await supabase
    .from("teams")
    .select("id, name, category, season_id")
    .order("name");

  const { data: seasons } = await supabase
    .from("seasons")
    .select("id, name, is_active")
    .order("name", { ascending: false });

  const cookieStore = await cookies();
  let activeTeamId: string = cookieStore.get("cl_active_team_id")?.value ?? "";
  let activeSeasonId: string = cookieStore.get("cl_active_season_id")?.value ?? "";

  const teamList = teams ?? [];
  const seasonList = seasons ?? [];

  let activeTeam = teamList.find((t) => t.id === activeTeamId);
  if (!activeTeam) {
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

  /**
   * Branding CSS: only semantic variables are set — no Tailwind utility class overrides.
   * Components should use `bg-primary`, `text-primary`, `text-primary-foreground`, etc.
   */
  const brandingCss = clubPrimaryColor
    ? `
      :root {
        --primary: ${clubPrimaryColor};
        --primary-foreground: ${primaryForeground};
        --ring: ${clubPrimaryColor};
        --sidebar-primary: ${clubPrimaryColor};
        --sidebar-ring: ${clubPrimaryColor};
        --sidebar-primary-foreground: ${primaryForeground};
        ${clubSecondaryColor ? `--accent: ${clubSecondaryColor};` : ""}
        ${isDark ? "--primary-border-boost: rgba(255,255,255,0.2);" : ""}
      }
    `
    : "";

  return (
    <SidebarProvider>
      <PageTracker />
      {brandingCss && (
        <style dangerouslySetInnerHTML={{ __html: brandingCss }} />
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
