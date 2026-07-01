"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";

interface CustomTooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  className?: string;
}

export function CustomTooltip({
  content,
  children,
  position = "top",
  className,
}: CustomTooltipProps) {
  const [active, setActive] = useState(false);

  const show = () => setActive(true);
  const hide = () => setActive(false);

  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  const arrowClasses = {
    top: "top-full left-1/2 -translate-x-1/2 -mt-[5px] border-t-slate-950/80",
    bottom: "bottom-full left-1/2 -translate-x-1/2 -mb-[5px] border-b-slate-950/80",
    left: "left-full top-1/2 -translate-y-1/2 -ml-[5px] border-l-slate-950/80",
    right: "right-full top-1/2 -translate-y-1/2 -mr-[5px] border-r-slate-950/80",
  };

  return (
    <div
      className="relative inline-flex items-center justify-center"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {active && content && (
        <div
          className={cn(
            "absolute z-50 pointer-events-none whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-white shadow-xl border border-white/10 bg-slate-950/80 backdrop-blur-md transition-all duration-150 ease-out select-none",
            positionClasses[position],
            className
          )}
          role="tooltip"
        >
          {content}
          <div
            className={cn(
              "absolute w-0 h-0 border-4 border-transparent pointer-events-none",
              arrowClasses[position]
            )}
          />
        </div>
      )}
    </div>
  );
}
