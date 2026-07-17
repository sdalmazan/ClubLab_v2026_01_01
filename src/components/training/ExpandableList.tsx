"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface ExpandableListProps {
  children: React.ReactNode[];
  initialCount?: number;
}

export function ExpandableList({ children, initialCount = 4 }: ExpandableListProps) {
  const [expanded, setExpanded] = useState(false);
  const total = children.length;

  if (total <= initialCount) {
    return <>{children}</>;
  }

  const visibleChildren = expanded ? children : children.slice(0, initialCount);

  return (
    <div className="space-y-3">
      {visibleChildren}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full py-2 px-4 rounded-xl border border-white/5 bg-white/2 text-slate-350 hover:bg-white/5 hover:text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.01)]"
      >
        {expanded ? (
          <>
            <span>Ver menos</span>
            <ChevronUp className="h-3.5 w-3.5" />
          </>
        ) : (
          <>
            <span>Mostrar más ({total - initialCount} más)</span>
            <ChevronDown className="h-3.5 w-3.5" />
          </>
        )}
      </button>
    </div>
  );
}
