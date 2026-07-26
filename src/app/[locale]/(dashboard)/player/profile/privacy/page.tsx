"use client";

import React from "react";
import Link from "next/link";
import { PlayerBottomNav } from "@/components/player/PlayerBottomNav";
import { PrivacyControlCenter } from "@/components/player/PrivacyControlCenter";
import { ArrowLeft } from "lucide-react";

export default function PlayerPrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground pb-24 px-4 py-6 max-w-lg mx-auto space-y-5">
      {/* Back Link */}
      <Link
        href="/player/profile"
        className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Volver a Perfil</span>
      </Link>

      {/* Privacy Control Center Component */}
      <PrivacyControlCenter />

      {/* Mobile Navigation */}
      <PlayerBottomNav />
    </div>
  );
}
