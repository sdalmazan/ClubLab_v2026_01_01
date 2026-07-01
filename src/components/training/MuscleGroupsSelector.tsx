"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { MUSCLE_GROUPS } from "@/lib/exercise-taxonomy";

interface MuscleGroupsSelectorProps {
  value: string[];
  onChange: (keys: string[]) => void;
}

const ZONE_ORDER = ['Cadena Posterior', 'Cadena Anterior', 'Cadera-Ingle', 'General'];

const ZONE_COLORS: Record<string, { dot: string; label: string; selected: string }> = {
  'Cadena Posterior': {
    dot: 'bg-rose-400',
    label: 'text-rose-400',
    selected: 'bg-rose-500/20 border-rose-500/40 text-rose-300 shadow-rose-900/30',
  },
  'Cadena Anterior': {
    dot: 'bg-sky-400',
    label: 'text-sky-400',
    selected: 'bg-sky-500/20 border-sky-500/40 text-sky-300 shadow-sky-900/30',
  },
  'Cadera-Ingle': {
    dot: 'bg-amber-400',
    label: 'text-amber-400',
    selected: 'bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-amber-900/30',
  },
  'General': {
    dot: 'bg-slate-400',
    label: 'text-slate-400',
    selected: 'bg-slate-500/20 border-slate-400/30 text-slate-200 shadow-slate-900/30',
  },
};

export function MuscleGroupsSelector({ value, onChange }: MuscleGroupsSelectorProps) {
  const [muscles, setMuscles] = useState<any[]>([...MUSCLE_GROUPS]);

  useEffect(() => {
    async function loadCustomMuscles() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: orgRole } = await supabase
          .from("user_organization_roles")
          .select("organizations ( settings )")
          .eq("user_id", user.id)
          .single();

        const custom = (orgRole as any)?.organizations?.settings?.custom_muscle_groups;
        if (custom && Array.isArray(custom) && custom.length > 0) {
          setMuscles(custom);
        }
      } catch (err) {
        console.error("Error loading custom muscles", err);
      }
    }
    loadCustomMuscles();
  }, []);

  // Group by zone
  const ZONE_GROUPS = muscles.reduce<Record<string, any[]>>((acc, mg) => {
    if (!acc[mg.zone]) acc[mg.zone] = [];
    acc[mg.zone].push(mg);
    return acc;
  }, {});

  const toggle = (key: string) => {
    if (value.includes(key)) {
      onChange(value.filter((k) => k !== key));
    } else {
      onChange([...value, key]);
    }
  };

  return (
    <div className="space-y-3">
      {ZONE_ORDER.filter((zone) => ZONE_GROUPS[zone]).map((zone) => {
        const colors = ZONE_COLORS[zone] ?? {
          dot: 'bg-slate-400',
          label: 'text-slate-400',
          selected: 'bg-slate-500/20 border-slate-400/30 text-slate-200 shadow-slate-900/30',
        };
        return (
          <div key={zone}>
            {/* Zone header */}
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
              <span className={`text-[10px] font-bold uppercase tracking-wider ${colors.label}`}>
                {zone}
              </span>
            </div>

            {/* Muscle pills */}
            <div className="flex flex-wrap gap-1.5">
              {ZONE_GROUPS[zone].map((mg) => {
                const isSelected = value.includes(mg.key);
                return (
                  <button
                    key={mg.key}
                    type="button"
                    onClick={() => toggle(mg.key)}
                    className={
                      `rounded-full px-2.5 py-1 text-[10px] font-semibold border transition-all cursor-pointer ` +
                      (isSelected
                        ? `${colors.selected} shadow-sm`
                        : 'bg-white/3 border-white/8 text-slate-400 hover:bg-white/8 hover:text-slate-200 hover:border-white/15')
                    }
                  >
                    {mg.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Selection summary */}
      {value.length > 0 && (
        <div className="flex items-center gap-1.5 pt-0.5">
          <span className="text-[10px] text-slate-500 font-medium">
            {value.length} grupo{value.length !== 1 ? 's' : ''} seleccionado{value.length !== 1 ? 's' : ''}
          </span>
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-[10px] text-slate-600 hover:text-rose-400 font-bold transition-colors"
          >
            · limpiar
          </button>
        </div>
      )}
    </div>
  );
}
