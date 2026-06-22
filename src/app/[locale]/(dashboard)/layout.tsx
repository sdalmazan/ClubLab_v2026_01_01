import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { LanguageSelector } from "@/components/layout/LanguageSelector";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { AuthUser } from "@/types";

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
        slug,
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
  const plan = org?.subscriptions?.[0]?.plans?.slug ?? "free";

  const authUser: AuthUser = {
    id: user.id,
    email: user.email ?? "",
    organization_id: orgRole.organization_id,
    organization_slug: org?.slug ?? "",
    role: orgRole.role,
    team_id: orgRole.team_id ?? null,
    plan_slug: plan,
  };

  return (
    <SidebarProvider>
      <AppSidebar user={authUser} />
      <SidebarInset>
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.06] bg-[rgb(6_8_20)] px-4 sticky top-0 z-40">
          <SidebarTrigger className="text-slate-400 hover:text-white transition-colors" />
          <div className="h-4 w-px bg-white/10" />
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
