"use client";

import { PageHeader } from "@/components/ui/page-header";
import { AcademySubNav } from "@/components/academy/AcademySubNav";
import { FacilitiesQuadrant } from "@/components/academy/FacilitiesQuadrant";
import { TacticalProgressMatrix } from "@/components/academy/TacticalProgressMatrix";

export default function AcademyDashboardPage() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-fade-in text-white">
      {/* ── PAGE HEADER ── */}
      <PageHeader
        title="Gestión de la Academia, Metodología & Cantera"
        description="Centro de mando de la S.D. Almazán: cuadrante de campos, cumplimiento metodológico táctico y seguimiento de cantera"
      />

      {/* ── SUBNAV ── */}
      <AcademySubNav />

      {/* ── SECTION 1: CUADRANTE DE INSTALACIONES ── */}
      <FacilitiesQuadrant />

      {/* ── SECTION 2: MATRIZ DE CUMPLIMIENTO METODOLÓGICO TÁCTICO ── */}
      <TacticalProgressMatrix />
    </div>
  );
}
