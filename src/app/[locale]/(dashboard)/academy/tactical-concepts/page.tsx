"use client";

import { PageHeader } from "@/components/ui/page-header";
import { AcademySubNav } from "@/components/academy/AcademySubNav";
import { TacticalProgressMatrix } from "@/components/academy/TacticalProgressMatrix";

export default function AcademyTacticalConceptsPage() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-fade-in text-white">
      <PageHeader
        title="Monitorización Táctica de Cantera"
        description="Seguimiento metodológico de minutos de entrenamiento invertidos en conceptos tácticos por categoría"
      />
      <AcademySubNav />
      <TacticalProgressMatrix />
    </div>
  );
}
