"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Activity,
  Trophy,
  BookOpen,
  LayoutDashboard,
  Calendar
} from "lucide-react";
import { cn } from "@/lib/utils";

export function AcademySubNav() {
  const pathname = usePathname();

  const navItems = [
    { href: "/academy", label: "Visión General", icon: LayoutDashboard },
    { href: "/academy/facilities", label: "Cuadrante de Instalaciones", icon: Building2 },
    { href: "/academy/tactical-concepts", label: "Monitorización Táctica", icon: Activity },
    { href: "/academy/results", label: "Resultados de Cantera", icon: Trophy },
    { href: "/academy/methodology", label: "Metodología del Club", icon: BookOpen },
  ];

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-white/10 pb-3">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || (item.href !== "/academy" && pathname.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs transition-all cursor-pointer",
              isActive
                ? "bg-primary text-primary-foreground font-bold shadow"
                : "bg-slate-900 border border-white/10 text-slate-400 hover:border-white/20 hover:text-white"
            )}
          >
            <Icon className={cn("size-3.5", isActive ? "text-primary-foreground" : "text-slate-400")} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
