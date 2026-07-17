import React, { useState, useEffect } from "react";
import { X, Printer, FileText, CheckCircle, Clock } from "lucide-react";
import { buildReportAction } from "@/features/analysis/actions";
import { ReportConfig } from "@/features/analysis/types";

interface ReportPreviewProps {
  config: ReportConfig;
  onClose: () => void;
}

/**
 * ReportPreview Component.
 * Compiles a ReportConfig using ReportBuilder and displays the structured layout.
 * Provides a clean, print-friendly preview and triggers browser print systems (PDF output).
 */
export const ReportPreview: React.FC<ReportPreviewProps> = ({ config, onClose }) => {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Compile the report dynamically upon mounting
  useEffect(() => {
    async function compile() {
      try {
        const res = await buildReportAction(config);
        setReport(res);
      } catch (err) {
        console.error("Fallo al construir reporte:", err);
      } finally {
        setLoading(false);
      }
    }
    compile();
  }, [config]);

  // Triggers browser print/pdf generation
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 overflow-y-auto print:p-0 print:bg-white print:relative">
      <div className="w-full max-w-4xl rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl overflow-hidden flex flex-col my-8 max-h-[90vh] print:max-h-none print:border-none print:bg-white print:my-0 print:shadow-none print:overflow-visible">
        {/* Modal Header */}
        <div className="flex items-center justify-between bg-slate-900 px-6 py-4 border-b border-slate-800 print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold text-white uppercase tracking-wider">Compilador de Informes (PDF)</h2>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handlePrint}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              <Printer className="h-4 w-4" />
              <span>Imprimir / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-800 bg-slate-900/60 p-2 text-slate-400 hover:text-white transition-all"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Printable Report Canvas */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-950 text-slate-300 print:bg-white print:text-black print:p-0 print:overflow-visible">
          {loading ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2 text-slate-500">
              <Clock className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm font-semibold">Compilando widgets y consultas estadísticas...</p>
            </div>
          ) : report ? (
            <div className="flex flex-col gap-8 max-w-3xl mx-auto print:mx-0">
              {/* Document Header */}
              <div className="border-b border-slate-800 pb-6 print:border-slate-300">
                <div className="flex items-center justify-between mb-2">
                  <h1 className="text-2xl font-black text-white print:text-black">{report.title}</h1>
                  <span className="text-[10px] bg-slate-900 border border-slate-800 px-2 py-0.5 rounded font-mono text-slate-500 print:border-slate-300 print:bg-slate-100 print:text-slate-600">
                    ClubLab Report Compiler
                  </span>
                </div>
                {report.description && (
                  <p className="text-xs text-slate-400 leading-relaxed print:text-slate-600">{report.description}</p>
                )}
                <div className="mt-4 text-[10px] text-slate-500 font-medium">
                  Generado el: {new Date(report.generatedAt).toLocaleString()}
                </div>
              </div>

              {/* Sections List */}
              {report.sections.map((section: any) => (
                <div key={section.id} className="flex flex-col gap-4 print:break-inside-avoid">
                  <h3 className="text-sm font-extrabold uppercase tracking-widest text-primary border-l-2 border-primary pl-3 print:text-black print:border-black">
                    {section.title}
                  </h3>

                  {/* Widgets Grid */}
                  <div className="grid grid-cols-2 gap-4 print:grid-cols-2">
                    {section.widgets.map((widget: any) => {
                      const isFull = widget.width === "full";
                      return (
                        <div
                          key={widget.id}
                          className={`rounded-xl border border-slate-800 bg-slate-900/30 p-4 print:border-slate-300 print:bg-white ${
                            isFull ? "col-span-2" : "col-span-1"
                          }`}
                        >
                          <h4 className="text-xs font-bold text-slate-400 mb-3 print:text-slate-800 uppercase tracking-wide">
                            {widget.title}
                          </h4>

                          {/* Widget Error State */}
                          {widget.error && (
                            <div className="text-xs text-red-400 bg-red-950/20 border border-red-900/40 p-2.5 rounded-lg">
                              {widget.error}
                            </div>
                          )}

                          {/* Widget Content rendering */}
                          {!widget.error && widget.type === "text" && (
                            <p className="text-xs text-slate-300 print:text-slate-700 leading-relaxed">
                              {widget.data}
                            </p>
                          )}

                          {!widget.error && widget.type === "kpi" && widget.data && (
                            <div className="flex flex-col">
                              <span className="text-3xl font-black text-white print:text-black">
                                {widget.data.value}
                              </span>
                              <span className="text-[10px] text-slate-500 font-medium mt-1">
                                {widget.data.metricName}
                              </span>
                            </div>
                          )}

                          {!widget.error && widget.type === "table" && widget.data && (
                            <div className="overflow-x-auto">
                              <table className="w-full text-xxs text-left border-collapse">
                                <thead>
                                  <tr className="border-b border-slate-800 print:border-slate-300 text-slate-500">
                                    <th className="py-2 pr-2">Nombre</th>
                                    {widget.data.headers.map((h: any) => (
                                      <th key={h.id} className="py-2 px-2 text-right">{h.label}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/40 print:divide-slate-200 text-slate-300 print:text-black">
                                  {widget.data.rows.map((row: any) => (
                                    <tr key={row.id}>
                                      <td className="py-2 pr-2 font-semibold">{row.name}</td>
                                      {widget.data.headers.map((h: any) => (
                                        <td key={h.id} className="py-2 px-2 text-right font-mono">
                                          {row.metrics[h.id]}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500">
              Error al cargar el reporte. Intentelo de nuevo.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default ReportPreview;
