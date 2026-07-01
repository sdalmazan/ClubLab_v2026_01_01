import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { LanguageSelector } from "@/components/layout/LanguageSelector";
import { HeaderContextSelector } from "@/components/layout/HeaderContextSelector";
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
 * - Renders sidebar + main content area
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

  let isLight = false;
  let isDark = false;
  if (clubPrimaryColor) {
    const hex = clubPrimaryColor.replace("#", "");
    if (hex.length === 6) {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      isLight = luminance > 170;
      isDark = luminance < 50;
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

  return (
    <SidebarProvider>
      <PageTracker />
      {clubPrimaryColor && (
        <style dangerouslySetInnerHTML={{ __html: `
          :root {
            --primary: ${clubPrimaryColor} !important;
            --ring: ${clubPrimaryColor} !important;
            --sidebar-primary: ${clubPrimaryColor} !important;
            --sidebar-ring: ${clubPrimaryColor} !important;
            --primary-foreground: ${isLight ? '#0f172a' : '#ffffff'} !important;
            --sidebar-primary-foreground: ${isLight ? '#0f172a' : '#ffffff'} !important;
            --color-brand-50: ${clubPrimaryColor}15 !important;
            --color-brand-400: ${clubPrimaryColor} !important;
            --color-brand-500: ${clubPrimaryColor} !important;
            --color-brand-600: ${clubPrimaryColor} !important;
            --color-brand-700: ${clubPrimaryColor} !important;
            --color-brand-900: ${clubPrimaryColor} !important;
            --color-brand-650: ${clubPrimaryColor} !important;
            --color-emerald-50: ${clubPrimaryColor}15 !important;
            --color-emerald-400: ${clubPrimaryColor} !important;
            --color-emerald-500: ${clubPrimaryColor} !important;
            --color-emerald-600: ${clubPrimaryColor} !important;
            --color-emerald-700: ${clubPrimaryColor} !important;
            --color-emerald-900: ${clubPrimaryColor} !important;
          }
          ${clubSecondaryColor ? `
          :root {
            --accent-500: ${clubSecondaryColor} !important;
            --color-accent-500: ${clubSecondaryColor} !important;
            --color-indigo-400: ${clubSecondaryColor} !important;
            --color-indigo-500: ${clubSecondaryColor} !important;
            --color-indigo-600: ${clubSecondaryColor} !important;
            --color-indigo-700: ${clubSecondaryColor} !important;
          }
          ` : ''}

          /* Force high contrast text on solid primary elements */
          .bg-primary,
          .bg-emerald-500,
          .bg-emerald-600,
          .bg-brand-500,
          .bg-brand-600,
          .from-emerald-500,
          .from-emerald-600,
          .from-brand-500,
          .from-brand-600,
          .from-primary,
          .to-emerald-500,
          .to-emerald-600,
          .to-brand-500,
          .to-brand-600,
          .to-primary {
            color: ${isLight ? '#0f172a' : '#ffffff'} !important;
          }

          .bg-primary *,
          .bg-emerald-500 *,
          .bg-emerald-600 *,
          .bg-brand-500 *,
          .bg-brand-600 *,
          .from-emerald-500 *,
          .from-emerald-600 *,
          .from-brand-500 *,
          .from-brand-600 *,
          .from-primary *,
          .to-emerald-500 *,
          .to-emerald-600 *,
          .to-brand-500 *,
          .to-brand-600 *,
          .to-primary * {
            color: ${isLight ? '#0f172a' : '#ffffff'} !important;
          }

          .bg-primary svg,
          .bg-emerald-500 svg,
          .bg-emerald-600 svg,
          .bg-brand-500 svg,
          .bg-brand-600 svg,
          .from-emerald-500 svg,
          .from-emerald-600 svg,
          .from-brand-500 svg,
          .from-brand-600 svg,
          .from-primary svg,
          .to-emerald-500 svg,
          .to-emerald-600 svg,
          .to-brand-500 svg,
          .to-brand-600 svg,
          .to-primary svg {
            stroke: ${isLight ? '#0f172a' : '#ffffff'} !important;
            color: ${isLight ? '#0f172a' : '#ffffff'} !important;
          }

          ${isLight ? `
            /* Add subtle border if primary is light/white */
            .bg-primary,
            .bg-emerald-500,
            .bg-emerald-600,
            .bg-brand-500,
            .bg-brand-600,
            .from-emerald-500,
            .from-emerald-600,
            .from-brand-500,
            .from-brand-600,
            .from-primary {
              border: 1px solid rgba(0, 0, 0, 0.15) !important;
            }
          ` : ''}

          ${isDark ? `
            /* Add subtle border if primary is dark/black to pop from dark background */
            .bg-primary,
            .bg-emerald-500,
            .bg-emerald-600,
            .bg-brand-500,
            .bg-brand-600,
            .from-emerald-500,
            .from-emerald-600,
            .from-brand-500,
            .from-brand-600,
            .from-primary {
              border: 1px solid rgba(255, 255, 255, 0.25) !important;
            }
          ` : ''}
        `}} />
      )}
      <AppSidebar user={authUser} />
      <SidebarInset>
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.06] bg-[rgb(6_8_20)] px-4 sticky top-0 z-40">
          <SidebarTrigger className="text-slate-400 hover:text-white transition-colors" />
          <div className="h-4 w-px bg-white/10" />
          
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
        {/* Page content */}
        <main className="flex flex-1 flex-col gap-0 p-6 min-h-[calc(100vh-3.5rem)]">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
