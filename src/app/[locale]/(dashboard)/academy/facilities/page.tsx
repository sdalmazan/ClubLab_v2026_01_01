"use client";

import { PageHeader } from "@/components/ui/page-header";
import { AcademySubNav } from "@/components/academy/AcademySubNav";
import { FacilitiesQuadrant } from "@/components/academy/FacilitiesQuadrant";

export default function AcademyFacilitiesPage() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-fade-in text-white">
      <PageHeader
        title="Cuadrante de Instalaciones & Campos"
        description="Distribución de franjas horarias y ocupación de terrenos de juego de la S.D. Almazán"
      />
      <AcademySubNav />
      <FacilitiesQuadrant />
    </div>
  );
}
