"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { TACTICAL_CONCEPTS } from "@/lib/exercise-taxonomy";

interface TacticalConceptsSelectorProps {
  value: string[];
  onChange: (keys: string[]) => void;
}

const CATEGORY_ORDER = ['Fase Ofensiva', 'Fase Defensiva', 'Transición A-D', 'Transición D-A', 'ABP'];

const CATEGORY_COLORS: Record<string, { dot: string; label: string }> = {
  'Fase Ofensiva':   { dot: 'bg-emerald-400', label: 'text-emerald-400' },
  'Fase Defensiva':  { dot: 'bg-rose-400',    label: 'text-rose-400'    },
  'Transición A-D':  { dot: 'bg-amber-400',   label: 'text-amber-400'   },
  'Transición D-A':  { dot: 'bg-sky-400',     label: 'text-sky-400'     },
  'ABP':             { dot: 'bg-violet-400',  label: 'text-violet-400'  },
};

export function TacticalConceptsSelector({ value, onChange }: TacticalConceptsSelectorProps) {
  const [concepts, setConcepts] = useState<any[]>([...TACTICAL_CONCEPTS]);

  useEffect(() => {
    async function loadCustomConcepts() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: orgRole } = await supabase
          .from("user_organization_roles")
          .select("organizations ( settings )")
          .eq("user_id", user.id)
          .single();

        const custom = (orgRole as any)?.organizations?.settings?.custom_tactical_concepts;
        if (custom && Array.isArray(custom) && custom.length > 0) {
          setConcepts(custom);
        }
      } catch (err) {
        console.error("Error loading custom concepts", err);
      }
    }
    loadCustomConcepts();
  }, []);

  // Group concepts by category
  const CONCEPT_GROUPS = concepts.reduce<Record<string, any[]>>((acc, concept) => {
    if (!acc[concept.category]) acc[concept.category] = [];
    acc[concept.category].push(concept);
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
      {CATEGORY_ORDER.filter((cat) => CONCEPT_GROUPS[cat]).map((cat) => {
        const colors = CATEGORY_COLORS[cat] ?? { dot: 'bg-slate-400', label: 'text-slate-400' };
        return (
          <div key={cat}>
            {/* Category header */}
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
              <span className={`text-[10px] font-bold uppercase tracking-wider ${colors.label}`}>
                {cat}
              </span>
            </div>

            {/* Concept pills */}
            <div className="flex flex-wrap gap-1.5">
              {CONCEPT_GROUPS[cat].map((concept) => {
                const isSelected = value.includes(concept.key);
                return (
                  <button
                    key={concept.key}
                    type="button"
                    onClick={() => toggle(concept.key)}
                    className={
                      `rounded-full px-2.5 py-1 text-[10px] font-semibold border transition-all cursor-pointer ` +
                      (isSelected
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-sm shadow-emerald-900/30'
                        : 'bg-white/3 border-white/8 text-slate-400 hover:bg-white/8 hover:text-slate-200 hover:border-white/15')
                    }
                  >
                    {concept.label}
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
            {value.length} concepto{value.length !== 1 ? 's' : ''} seleccionado{value.length !== 1 ? 's' : ''}
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
