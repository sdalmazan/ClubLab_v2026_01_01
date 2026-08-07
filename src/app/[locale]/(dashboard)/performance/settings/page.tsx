"use client";

import { PerformanceSubNav } from "@/components/performance/PerformanceSubNav";
import { PerformanceSettingsTab } from "@/components/settings/PerformanceSettingsTab";

export default function PerformanceSettingsPage() {
  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8 text-slate-100 space-y-6 animate-fade-in">
      {/* Sub Navigation */}
      <PerformanceSubNav />

      {/* Performance Settings Component (Thresholds, GPS Integration, Pitch Corners P1/P2, Rules Engine & Local Agent) */}
      <PerformanceSettingsTab />
    </div>
  );
}
