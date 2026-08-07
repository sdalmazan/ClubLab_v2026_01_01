"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Settings,
  Activity,
  Dumbbell,
  ClipboardList,
  Target,
  Sparkles
} from "lucide-react";

export function PerformanceSubNav() {
  const pathname = usePathname();

  const navItems = [
    { href: "/performance/dashboard", label: "Visión General", icon: LayoutDashboard },
    { href: "/performance/monitoring", label: "Monitorización", icon: Activity },
    { href: "/performance/testing", label: "Testing", icon: Target },
    { href: "/performance/routines", label: "Rutinas Físicas", icon: ClipboardList },
  ];

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs transition-all ${
              isActive
                ? "corp-badge font-bold shadow-sm"
                : "bg-slate-900/60 border border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
            }`}
          >
            <Icon className={`h-4 w-4 ${isActive ? "corp-text" : "text-slate-500"}`} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
