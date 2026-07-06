"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  HeartPulse,
  Activity,
  Trophy,
  GraduationCap,
  Settings,
  ShieldCheck,
  MoreHorizontal,
  ChevronDown,
  X,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { AuthUser } from "@/types";
import { can } from "@/lib/permissions/can";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

interface BottomNavBarProps {
  user: AuthUser;
}

interface SubItem {
  href: string;
  labelKey: string;
  icon: React.ElementType;
  requiredPermission?: Parameters<typeof can>[1];
}

interface NavTab {
  id: string;
  labelKey: string;
  icon: React.ElementType;
  href?: string;
  subItems?: SubItem[];
  requiredPermission?: Parameters<typeof can>[1];
  /** Only show to specific roles */
  requiredRoles?: string[];
}

// ─────────────────────────────────────────────────────────
// Navigation structure
// ─────────────────────────────────────────────────────────

const NAV_TABS: NavTab[] = [
  {
    id: "home",
    labelKey: "overview",
    icon: LayoutDashboard,
    href: "/dashboard",
  },
  {
    id: "squad",
    labelKey: "players",
    icon: Users,
    subItems: [
      { href: "/players", labelKey: "players", icon: Users, requiredPermission: "view_player_list" },
      { href: "/training", labelKey: "training", icon: CalendarDays, requiredPermission: "create_session" },
      { href: "/injuries", labelKey: "injuries", icon: HeartPulse, requiredPermission: "view_injuries" },
    ],
  },
  {
    id: "analysis",
    labelKey: "performance",
    icon: Activity,
    subItems: [
      { href: "/performance", labelKey: "performance", icon: Activity, requiredPermission: "view_team_loads" },
      { href: "/matches", labelKey: "matches", icon: Trophy, requiredPermission: "view_matches" },
    ],
  },
  {
    id: "academy",
    labelKey: "academy",
    icon: GraduationCap,
    href: "/academy",
    requiredRoles: [
      "academy_coordinator",
      "academy_director",
      "club_admin",
      "sporting_director",
      "super_admin",
    ],
  },
];

/** Secondary items shown in a "More" sheet */
const MORE_ITEMS: SubItem[] = [
  { href: "/settings", labelKey: "settings", icon: Settings },
  { href: "/admin", labelKey: "admin", icon: ShieldCheck, requiredPermission: "access_admin_panel" },
];

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

function canShowTab(tab: NavTab | SubItem, user: AuthUser): boolean {
  if ("requiredRoles" in tab && tab.requiredRoles) {
    // Special admin bypass
    if (
      (tab as NavTab).id === "academy" &&
      (user.email === "diecilo7@gmail.com" || user.role === "super_admin")
    ) return true;
    if (!tab.requiredRoles.includes(user.role)) return false;
  }
  if (tab.requiredPermission && !can(user, tab.requiredPermission)) return false;
  return true;
}

// ─────────────────────────────────────────────────────────
// Sub-menu Sheet (slide-up panel)
// ─────────────────────────────────────────────────────────

interface SubMenuSheetProps {
  tab: NavTab;
  user: AuthUser;
  isOpen: boolean;
  onClose: () => void;
  t: ReturnType<typeof useTranslations<"nav">>;
  isActive: (href: string) => boolean;
}

function SubMenuSheet({ tab, user, isOpen, onClose, t, isActive }: SubMenuSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, onClose]);

  // Close on route change
  const pathname = usePathname();
  useEffect(() => { onClose(); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleSubItems = tab.subItems?.filter((item) => canShowTab(item, user)) ?? [];

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Sheet */}
      <div
        ref={sheetRef}
        className={cn(
          "fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] left-2 right-2 z-50",
          "rounded-2xl border border-white/10 bg-[oklch(13%_0.03_265/0.95)] backdrop-blur-xl",
          "shadow-2xl shadow-black/80 p-3 md:hidden",
          "animate-in fade-in slide-in-from-bottom-2 duration-200"
        )}
        role="dialog"
        aria-label={`Menú ${t(tab.labelKey as any)}`}
      >
        {/* Sheet header */}
        <div className="flex items-center justify-between px-1 pb-2 mb-1 border-b border-white/[0.06]">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            {t(tab.labelKey as any)}
          </span>
          <button
            onClick={onClose}
            className="h-6 w-6 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Cerrar menú"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Sub-items */}
        <div className="flex flex-col gap-0.5">
          {visibleSubItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all",
                  active
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{t(item.labelKey as any)}</span>
                {active && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────
// More Sheet
// ─────────────────────────────────────────────────────────

interface MoreSheetProps {
  user: AuthUser;
  isOpen: boolean;
  onClose: () => void;
  t: ReturnType<typeof useTranslations<"nav">>;
  isActive: (href: string) => boolean;
}

function MoreSheet({ user, isOpen, onClose, t, isActive }: MoreSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, onClose]);

  useEffect(() => { onClose(); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleItems = MORE_ITEMS.filter((item) => {
    if (item.href === "/admin" && (user.email === "diecilo7@gmail.com" || user.role === "super_admin")) {
      return true;
    }
    return canShowTab(item, user);
  });

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={sheetRef}
        className={cn(
          "fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] left-2 right-2 z-50",
          "rounded-2xl border border-white/10 bg-[oklch(13%_0.03_265/0.95)] backdrop-blur-xl",
          "shadow-2xl shadow-black/80 p-3 md:hidden",
          "animate-in fade-in slide-in-from-bottom-2 duration-200"
        )}
        role="dialog"
        aria-label="Más opciones"
      >
        <div className="flex items-center justify-between px-1 pb-2 mb-1 border-b border-white/[0.06]">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Más opciones
          </span>
          <button
            onClick={onClose}
            className="h-6 w-6 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Cerrar menú"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex flex-col gap-0.5">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all",
                  active
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{t(item.labelKey as any)}</span>
                {active && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────
// Main BottomNavBar component
// ─────────────────────────────────────────────────────────

export function BottomNavBar({ user }: BottomNavBarProps) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const [openTabId, setOpenTabId] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.includes(href));

  /** Returns true if any sub-item of a tab is currently active */
  const isTabGroupActive = (tab: NavTab): boolean => {
    if (tab.href) return isActive(tab.href);
    return tab.subItems?.some((item) => isActive(item.href)) ?? false;
  };

  const handleTabPress = (tab: NavTab) => {
    if (tab.href) {
      setOpenTabId(null);
      setMoreOpen(false);
      return;
    }
    // Toggle sub-menu
    setMoreOpen(false);
    setOpenTabId(openTabId === tab.id ? null : tab.id);
  };

  const handleMorePress = () => {
    setOpenTabId(null);
    setMoreOpen(!moreOpen);
  };

  const visibleTabs = NAV_TABS.filter((tab) => canShowTab(tab, user));

  return (
    <>
      {/* Sub-menu sheets for tabs with sub-items */}
      {visibleTabs.map((tab) =>
        tab.subItems ? (
          <SubMenuSheet
            key={tab.id}
            tab={tab}
            user={user}
            isOpen={openTabId === tab.id}
            onClose={() => setOpenTabId(null)}
            t={t}
            isActive={isActive}
          />
        ) : null
      )}

      {/* More sheet */}
      <MoreSheet
        user={user}
        isOpen={moreOpen}
        onClose={() => setMoreOpen(false)}
        t={t}
        isActive={isActive}
      />

      {/* Bottom bar — mobile only */}
      <nav
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 md:hidden",
          "h-16 border-t border-white/[0.06]",
          "bg-[oklch(10%_0.02_265/0.92)] backdrop-blur-xl",
          "pb-[env(safe-area-inset-bottom)]",
          "flex items-center"
        )}
        aria-label="Navegación principal"
      >
        <div className="flex w-full items-center justify-around px-1">
          {/* Main tabs */}
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const groupActive = isTabGroupActive(tab);
            const isOpen = openTabId === tab.id;

            const content = (
              <div className="flex flex-col items-center gap-0.5 min-w-0">
                <div
                  className={cn(
                    "relative flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-200",
                    groupActive
                      ? "bg-primary/15"
                      : isOpen
                      ? "bg-white/10"
                      : "hover:bg-white/5"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4.5 w-4.5 transition-colors duration-200",
                      groupActive ? "text-primary" : "text-slate-400"
                    )}
                  />
                  {/* Active dot */}
                  {groupActive && (
                    <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary" />
                  )}
                  {/* Expand chevron for sub-menus */}
                  {tab.subItems && (
                    <ChevronDown
                      className={cn(
                        "absolute -bottom-1.5 -right-1 h-2.5 w-2.5 text-slate-600 transition-transform duration-200",
                        isOpen && "rotate-180"
                      )}
                    />
                  )}
                </div>
                <span
                  className={cn(
                    "text-[9px] font-semibold tracking-wide truncate max-w-[52px] leading-none",
                    groupActive ? "text-primary" : "text-slate-500"
                  )}
                >
                  {t(tab.labelKey as any)}
                </span>
              </div>
            );

            if (tab.href) {
              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  className="flex flex-1 items-center justify-center py-1.5 transition-opacity active:opacity-70"
                  onClick={() => { setOpenTabId(null); setMoreOpen(false); }}
                >
                  {content}
                </Link>
              );
            }

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabPress(tab)}
                className="flex flex-1 items-center justify-center py-1.5 transition-opacity active:opacity-70"
                aria-expanded={isOpen}
                aria-haspopup="dialog"
              >
                {content}
              </button>
            );
          })}

          {/* "More" button — always visible */}
          <button
            type="button"
            onClick={handleMorePress}
            className="flex flex-1 items-center justify-center py-1.5 transition-opacity active:opacity-70"
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
          >
            <div className="flex flex-col items-center gap-0.5">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-200",
                  moreOpen ? "bg-white/10" : "hover:bg-white/5"
                )}
              >
                {moreOpen ? (
                  <X className="h-4.5 w-4.5 text-slate-400" />
                ) : (
                  <MoreHorizontal className="h-4.5 w-4.5 text-slate-400" />
                )}
              </div>
              <span className="text-[9px] font-semibold tracking-wide text-slate-500 leading-none">
                Más
              </span>
            </div>
          </button>
        </div>
      </nav>
    </>
  );
}
