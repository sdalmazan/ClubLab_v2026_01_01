"use client";

import React, { useState } from "react";
import { Shield } from "lucide-react";

interface ClubBrandingProps {
  logoUrl?: string | null;
  clubName?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  showName?: boolean;
}

export function ClubBranding({
  logoUrl,
  clubName = "S.D. Almazán",
  size = "md",
  className = "",
  showName = false,
}: ClubBrandingProps) {
  const [imageError, setImageError] = useState(false);

  // Compute initials (e.g. "S.D. Almazán" -> "SDA")
  const cleanName = (clubName || "Club").trim();
  const initials = cleanName
    .split(/\s+/)
    .map((word) => word.replace(/[^a-zA-Z]/g, "")[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 3) || "CL";

  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-xs font-bold",
    lg: "w-12 h-12 text-sm font-black",
    xl: "w-16 h-16 text-lg font-black",
  };

  const hasValidLogo = Boolean(logoUrl && !imageError);

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className={`relative shrink-0 rounded-2xl overflow-hidden flex items-center justify-center border border-blue-500/30 bg-gradient-to-br from-blue-600/20 to-indigo-600/20 shadow-md ${sizeClasses[size]}`}>
        {hasValidLogo ? (
          <img
            src={logoUrl!}
            alt={`Escudo oficial de ${cleanName}`}
            onError={() => setImageError(true)}
            className="w-full h-full object-contain p-1"
          />
        ) : (
          <div className="flex flex-col items-center justify-center w-full h-full text-blue-400">
            <Shield className="w-full h-full opacity-20 absolute inset-0 p-1" />
            <span className="relative z-10 tracking-widest font-black text-blue-400">
              {initials}
            </span>
          </div>
        )}
      </div>

      {showName && (
        <div className="leading-tight">
          <span className="text-[10px] font-extrabold uppercase text-blue-500 tracking-wider block">
            Club Oficial
          </span>
          <span className="text-xs font-bold text-foreground truncate max-w-[160px] block">
            {cleanName}
          </span>
        </div>
      )}
    </div>
  );
}
