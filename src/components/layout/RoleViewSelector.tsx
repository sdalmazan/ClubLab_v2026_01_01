"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Building2,
  Briefcase,
  GraduationCap,
  ClipboardList,
  UserCheck,
  Users,
  Dumbbell,
  HeartPulse,
  User,
  ChevronDown,
  Eye,
  RotateCcw,
  Sparkles,
  Check,
} from "lucide-react";
import type { UserRole } from "@/types";
import { ROLE_MODE_OPTIONS, type RoleOption } from "@/lib/permissions/roleOverride";
import { cn } from "@/lib/utils";

interface RoleViewSelectorProps {
  currentRole: UserRole;
  actualRole: UserRole;
}

const ICON_MAP: Record<string, React.ElementType> = {
  ShieldCheck,
  Building2,
  Briefcase,
  GraduationCap,
  ClipboardList,
  UserCheck,
  Users,
  Dumbbell,
  HeartPulse,
  User,
};

export function RoleViewSelector({ currentRole, actualRole }: RoleViewSelectorProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const isSimulating = currentRole !== "super_admin";
  const activeOption = ROLE_MODE_OPTIONS.find((r) => r.value === currentRole) || ROLE_MODE_OPTIONS[0];
  const ActiveIcon = ICON_MAP[activeOption.iconName] || Eye;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleRoleSelect = (role: UserRole) => {
    if (role === "super_admin") {
      document.cookie = "cl_role_override=; path=/; max-age=0; SameSite=Lax";
      window.location.href = "/dashboard";
    } else {
      document.cookie = `cl_role_override=${role}; path=/; max-age=2592000; SameSite=Lax`;
      if (role === "player") {
        window.location.href = "/player";
      } else if (role === "physio") {
        window.location.href = "/injuries";
      } else {
        window.location.href = "/dashboard";
      }
    }
    setOpen(false);
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium transition-all duration-200 cursor-pointer outline-none select-none shadow-md",
          isSimulating
            ? "border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 shadow-amber-950/20"
            : "border border-violet-500/30 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20 hover:border-violet-400/50 shadow-violet-950/20"
        )}
        title="Cambiar modo de vista (Impersonación Super Admin)"
      >
        <div
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-lg text-white shadow-sm",
            isSimulating ? "bg-amber-500" : "bg-gradient-to-tr from-violet-600 to-indigo-500"
          )}
        >
          {isSimulating ? (
            <Eye className="h-3 w-3 text-slate-950 animate-pulse" />
          ) : (
            <Sparkles className="h-3 w-3 text-white" />
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 hidden lg:inline">
            Modo:
          </span>
          <span className="font-semibold text-white truncate max-w-[110px] sm:max-w-[140px]">
            {activeOption.label}
          </span>
          {isSimulating && (
            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
              SIMULADO
            </span>
          )}
        </div>

        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-slate-400 transition-transform duration-200 shrink-0",
            open && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown Menu */}
      {open && (
        <div className="absolute right-0 sm:left-0 sm:right-auto mt-2 w-80 sm:w-96 rounded-2xl border border-white/10 bg-slate-950/95 backdrop-blur-xl p-2.5 shadow-2xl shadow-black/90 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="px-3 pt-2 pb-2.5 border-b border-white/[0.08] mb-1.5 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-white uppercase tracking-wider">
                <Eye className="h-3.5 w-3.5 text-violet-400" />
                <span>Simulador de Roles (Super Admin)</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Comprueba los flujos de trabajo y permisos de cada rol en el portal.
              </p>
            </div>
          </div>

          {/* Role Options */}
          <div className="max-h-[380px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
            {ROLE_MODE_OPTIONS.map((opt: RoleOption) => {
              const IconComp = ICON_MAP[opt.iconName] || Eye;
              const isSelected = currentRole === opt.value;

              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleRoleSelect(opt.value)}
                  className={cn(
                    "w-full text-left p-2.5 rounded-xl text-xs transition-all duration-150 cursor-pointer flex items-start gap-3 group border",
                    isSelected
                      ? "bg-violet-600/15 border-violet-500/40 text-white"
                      : "bg-transparent border-transparent hover:bg-white/[0.05] text-slate-300 hover:text-white"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg mt-0.5 transition-colors",
                      isSelected
                        ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
                        : "bg-slate-900 border border-white/10 text-slate-400 group-hover:text-violet-300 group-hover:border-violet-500/30"
                    )}
                  >
                    <IconComp className="h-4 w-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-white truncate text-xs">
                        {opt.label}
                      </span>
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 shrink-0">
                        {opt.badge}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight mt-0.5 line-clamp-1">
                      {opt.description}
                    </p>
                  </div>

                  {isSelected && (
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-violet-400 mt-1">
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Reset button if simulating */}
          {isSimulating && (
            <div className="pt-2 mt-1.5 border-t border-white/[0.08]">
              <button
                type="button"
                onClick={() => handleRoleSelect("super_admin")}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 text-violet-200 border border-violet-500/30 text-xs font-semibold transition-all cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Restablecer a Modo Super Admin</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
