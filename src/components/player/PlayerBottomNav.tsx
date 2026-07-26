"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, Activity, Trophy, ShieldCheck, User } from "lucide-react";

export function PlayerBottomNav() {
  const pathname = usePathname();

  const navItems = [
    {
      label: "Hoy",
      href: "/player",
      icon: Sparkles,
      isActive: pathname === "/player" || pathname?.endsWith("/player"),
    },
    {
      label: "Mi Estado",
      href: "/player/status",
      icon: Activity,
      isActive: pathname?.includes("/player/status"),
    },
    {
      label: "Partidos",
      href: "/player/matches",
      icon: Trophy,
      isActive: pathname?.includes("/player/matches"),
    },
    {
      label: "Recomendaciones",
      href: "/player/recommendations",
      icon: ShieldCheck,
      isActive: pathname?.includes("/player/recommendations"),
    },
    {
      label: "Perfil",
      href: "/player/profile",
      icon: User,
      isActive: pathname?.includes("/player/profile"),
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-t border-border/40 px-2 py-2 sm:hidden shadow-2xl">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.isActive;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 px-1 rounded-xl transition-all duration-200 active:scale-95 ${
                active
                  ? "text-blue-500 font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform duration-200 ${
                    active ? "scale-110 text-blue-500" : ""
                  }`}
                />
                {active && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                )}
              </div>
              <span className="text-[10px] mt-1 tracking-tight leading-none truncate max-w-[64px]">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
