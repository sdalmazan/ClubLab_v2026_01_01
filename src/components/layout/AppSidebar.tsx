"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  Users,
  User,
  CalendarDays,
  Activity,
  HeartPulse,
  Trophy,
  Binoculars,
  GraduationCap,
  Settings,
  ShieldCheck,
  ChevronRight,
  Dumbbell,
  LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { AuthUser } from "@/types";
import { can } from "@/lib/permissions/can";
import { checkFeature } from "@/lib/licensing/checkFeature";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";

// ============================================================
// NAV STRUCTURE
// ============================================================

interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ElementType;
  requiredPermission?: Parameters<typeof can>[1];
  requiredFeature?: Parameters<typeof checkFeature>[1];
  badge?: string;
}

const NAV_MAIN: NavItem[] = [
  { href: "/dashboard", labelKey: "overview", icon: LayoutDashboard },
  { href: "/player", labelKey: "player_portal", icon: User },
  {
    href: "/players",
    labelKey: "players",
    icon: Users,
    requiredPermission: "view_player_list",
  },
  {
    href: "/training",
    labelKey: "training",
    icon: CalendarDays,
    requiredPermission: "view_session_library",
  },
  {
    href: "/performance",
    labelKey: "performance",
    icon: Activity,
    requiredPermission: "view_team_loads",
  },
  {
    href: "/injuries",
    labelKey: "injuries",
    icon: HeartPulse,
    requiredPermission: "view_injuries",
  },
  {
    href: "/matches",
    labelKey: "matches",
    icon: Trophy,
    requiredPermission: "view_matches",
  },
  {
    href: "/scouting",
    labelKey: "scouting",
    icon: Binoculars,
    requiredPermission: "view_scouting",
  },
  {
    href: "/academy",
    labelKey: "academy",
    icon: GraduationCap,
  },
];

const NAV_ADVANCED: NavItem[] = [];

const NAV_SYSTEM: NavItem[] = [
  { href: "/settings", labelKey: "settings", icon: Settings },
  {
    href: "/admin",
    labelKey: "admin",
    icon: ShieldCheck,
    requiredPermission: "access_admin_panel",
  },
];

// ============================================================
// COMPONENT
// ============================================================

interface AppSidebarProps {
  user: AuthUser;
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("nav");

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  const filterItems = (items: NavItem[]) =>
    items.filter((item) => {
      const userRoleStr = user.role as string;
      // Players see dedicated player navigation
      if (userRoleStr === "player") {
        const allowedPlayerHrefs = ["/player", "/performance/routines", "/settings"];
        return allowedPlayerHrefs.includes(item.href);
      }
      if (item.href === "/player" && userRoleStr !== "player") {
        return false;
      }
      if (item.href === "/admin" && (user.email === "diecilo7@gmail.com" || userRoleStr === "super_admin")) {
        return true;
      }
      if (item.href === "/academy" && (
        userRoleStr === "academy_coordinator" ||
        userRoleStr === "academy_director" ||
        userRoleStr === "club_admin" ||
        userRoleStr === "sporting_director" ||
        userRoleStr === "super_admin"
      )) {
        return true;
      }
      if (userRoleStr === "physio") {
        const allowedPhysioHrefs = ["/injuries", "/training", "/matches", "/settings"];
        return allowedPhysioHrefs.includes(item.href);
      }
      if (item.requiredPermission && !can(user, item.requiredPermission))
        return false;
      if (item.requiredFeature && !checkFeature(user, item.requiredFeature))
        return false;
      return true;
    });

  const mainItems = filterItems(NAV_MAIN);
  const advancedItems = filterItems(NAV_ADVANCED);
  const systemItems = filterItems(NAV_SYSTEM);

  const initials = user.email ? user.email.split("@")[0].slice(0, 2).toUpperCase() : "CL";

  return (
    <Sidebar variant="sidebar" collapsible="icon" className="hidden md:flex border-r border-border/40">
      {/* ── HEADER — Club Identity ── */}
      <SidebarHeader className="px-4 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:items-center py-4 transition-all duration-200">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          {user.club_logo_url ? (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-card border border-border p-1 overflow-hidden transition-all">
              <img src={user.club_logo_url} className="h-full w-full object-contain" alt="Escudo" />
            </div>
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 transition-all">
              <Dumbbell className="h-4 w-4" />
            </div>
          )}
          <div className="flex flex-col overflow-hidden group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold tracking-tight text-foreground leading-tight truncate max-w-[130px]" title={user.club_name ?? "ClubLab"}>
              {user.club_name ?? "ClubLab"}
            </span>
            <span className="text-[10px] text-muted-foreground font-medium mt-0.5">
              {user.role === "super_admin" ? "Super Admin" : "Cuerpo Técnico"}
            </span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarSeparator className="mx-4 group-data-[collapsible=icon]:mx-2 opacity-50" />

      <SidebarContent className="px-2 py-3 group-data-[collapsible=icon]:px-0 space-y-4">
        {/* Main navigation */}
        <SidebarGroup className="group-data-[collapsible=icon]:px-0">
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {mainItems.map((item) => {
                const active = isActive(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={t(item.labelKey as any)}
                      render={
                        <Link 
                          href={item.href} 
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-md transition-colors",
                            active 
                              ? "bg-primary/10 text-primary font-semibold border-l-2 border-primary rounded-l-none" 
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                          )}
                        >
                          <item.icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                          <span>{t(item.labelKey as any)}</span>
                          {item.badge && (
                            <Badge
                              variant="secondary"
                              className="ml-auto text-[10px] px-1.5 py-0"
                            >
                              {item.badge}
                            </Badge>
                          )}
                        </Link>
                      }
                    />
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* System navigation */}
        <SidebarGroup className="mt-auto group-data-[collapsible=icon]:px-0 pt-4">
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {systemItems.map((item) => {
                const active = isActive(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={t(item.labelKey as any)}
                      render={
                        <Link 
                          href={item.href} 
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-md transition-colors",
                            active 
                              ? "bg-primary/10 text-primary font-semibold border-l-2 border-primary rounded-l-none" 
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                          )}
                        >
                          <item.icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                          <span>{t(item.labelKey as any)}</span>
                        </Link>
                      }
                    />
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator className="mx-4 group-data-[collapsible=icon]:mx-2 opacity-50" />

      {/* ── FOOTER — User info ── */}
      <SidebarFooter className="px-4 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center py-4 transition-all duration-200">
        <div className="flex items-center justify-between group-data-[collapsible=icon]:justify-center w-full">
          <div className="flex items-center gap-3 overflow-hidden">
            <Avatar className="h-8 w-8 shrink-0 ring-2 ring-primary/20">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col overflow-hidden group-data-[collapsible=icon]:hidden">
              <span className="text-xs font-semibold text-white truncate">
                {user.email}
              </span>
              <span className="text-[10px] text-slate-500 truncate">
                {user.organization_slug}
              </span>
              <span className="text-[9px] text-slate-600 truncate mt-0.5">
                v2026.01.02
              </span>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="text-slate-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-white/5 transition-colors group-data-[collapsible=icon]:hidden"
            title="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
        {/* Collapsed logout icon */}
        <button
          onClick={handleSignOut}
          className="hidden group-data-[collapsible=icon]:flex h-8 w-8 mt-2 items-center justify-center text-slate-400 hover:text-red-400 rounded-lg hover:bg-white/5 transition-colors"
          title="Cerrar sesión"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
