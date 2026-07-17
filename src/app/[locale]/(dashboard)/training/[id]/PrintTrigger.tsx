"use client";

import { Printer } from "lucide-react";

export function PrintTrigger() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="btn-corporate flex items-center gap-2 rounded-xl text-white text-xs font-semibold px-4 py-2.5 transition-all shadow-lg cursor-pointer"
      title="Imprimir informe o guardar como PDF"
    >
      <Printer className="h-4 w-4" />
      Exportar PDF
    </button>
  );
}
