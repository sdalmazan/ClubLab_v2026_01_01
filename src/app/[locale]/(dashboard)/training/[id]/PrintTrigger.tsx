"use client";

import { Printer } from "lucide-react";

export function PrintTrigger() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs font-semibold px-4 py-2.5 transition-all shadow-lg shadow-emerald-950/40 cursor-pointer"
      title="Imprimir informe o guardar como PDF"
    >
      <Printer className="h-4 w-4" />
      Exportar PDF
    </button>
  );
}
