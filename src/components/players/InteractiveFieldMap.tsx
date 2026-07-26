"use client";

import { useState, useEffect, useRef } from "react";
import { FieldMap } from "./FieldMap";
import type { PositionKey } from "@/types";
import { POSITION_LABELS, getPositionLabel, resolveCampogramaSlot } from "@/types";
import type { PlayerWithMembership } from "@/services/players";
import { User, Target, CalendarDays, Activity, ChevronDown, Printer, Shield } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { toPng } from "html-to-image";

interface InteractiveFieldMapProps {
  players: PlayerWithMembership[];
  organizationSettings?: any;
}

const FORMATIONS = [
  "4-3-3",
  "4-4-2",
  "3-5-2",
  "3-4-3",
  "5-3-2",
  "4-2-3-1",
  "4-1-4-1",
  "4-5-1",
  "5-4-1",
  "3-6-1",
];

const POSITION_ORDER: PositionKey[] = [
  "goalkeeper",
  "left_back",
  "left_center_back",
  "right_center_back",
  "right_back",
  "defensive_midfielder",
  "playmaker_midfielder",
  "attacking_midfielder",
  "left_winger",
  "right_winger",
  "striker",
];

export function InteractiveFieldMap({ players = [], organizationSettings }: InteractiveFieldMapProps) {
  const activeSeasonName = players.find(p => p.membership?.seasons?.name)?.membership?.seasons?.name;
  const [selectedPosition, setSelectedPosition] = useState<PositionKey | null>(null);
  const [formation, setFormation] = useState<string>("4-3-3");
  const [formationsOpen, setFormationsOpen] = useState(false);
  const [showFilials, setShowFilials] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // Load preferred formation on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("cl_preferred_formation");
      if (saved) setFormation(saved);
    }
  }, []);

  // Filter players by filial status: if showFilials is false, only show main (Senior) players
  const visiblePlayers = players.filter((p) => {
    const isMain = p.membership?.player_type === "main" || !p.membership?.player_type;
    return showFilials || isMain;
  });

  // Build field assignments from all players for the FieldMap
  const assignments: Record<PositionKey, any[]> = {} as Record<PositionKey, any[]>;
  for (const p of visiblePlayers) {
    const primaryPos = p.membership?.positions?.[0];
    if (primaryPos) {
      const slot = resolveCampogramaSlot(primaryPos); // Map custom position to default campograma slot!
      if (!assignments[slot]) assignments[slot] = [];
      assignments[slot].push({
        playerId: p.id,
        name: `${p.first_name} ${p.last_name}`,
        lastName: p.last_name || "",
        sportingName: p.sporting_name,
        isPrimary: true,
        status: p.membership?.player_type === "reserve" ? "yellow" : p.membership?.player_type === "youth" ? "red" : "green",
        signingStatus: p.signing_status,
        birthYear: p.date_of_birth ? new Date(p.date_of_birth).getFullYear().toString() : "",
        seasonStartYear: p.membership?.seasons?.start_date
          ? new Date(p.membership.seasons.start_date).getFullYear().toString()
          : new Date().getFullYear().toString(),
        adjective: p.adjective || "",
      });
    }
  }

  // Filter players on the right column
  const filteredPlayers = selectedPosition
    ? visiblePlayers.filter((p) => p.membership?.positions?.some(pos => resolveCampogramaSlot(pos) === selectedPosition))
    : visiblePlayers;

  // Sort players GK -> DF -> MF -> FW
  const sortedPlayers = [...filteredPlayers].sort((a, b) => {
    const posA = a.membership?.positions?.[0] ? resolveCampogramaSlot(a.membership.positions[0]) : "";
    const posB = b.membership?.positions?.[0] ? resolveCampogramaSlot(b.membership.positions[0]) : "";
    const idxA = posA ? POSITION_ORDER.indexOf(posA) : 999;
    const idxB = posB ? POSITION_ORDER.indexOf(posB) : 999;
    return idxA - idxB;
  });

  const handlePositionClick = (pos: PositionKey) => {
    setSelectedPosition(pos === selectedPosition ? null : pos);
  };

  const fieldRef = useRef<HTMLDivElement>(null);
  const printFieldRef = useRef<HTMLDivElement>(null);

  const exportToPdf = async () => {
    if (!printFieldRef.current) return;
    
    try {
      // 1. Capture the tactical field map container as high resolution PNG (crisp 4x scale)
      const node = printFieldRef.current;
      const width = node.scrollWidth || node.offsetWidth || 600;
      const height = node.scrollHeight || node.offsetHeight || Math.round(width * 1.4);
      
      const dataUrl = await toPng(node, {
        width: width,
        height: height,
        pixelRatio: 4,
        cacheBust: true,
        backgroundColor: "#1E3F20",
      });

      // 2. Create the PDF document
      const pdfDoc = await PDFDocument.create();
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      
      // Page size A4 (595.28 x 841.89 points)
      const page = pdfDoc.addPage([595.28, 841.89]);
      const { width: pageWidth, height: pageHeight } = page.getSize();
      
      const topMargin = 25;
      const leftMargin = 30;
      
      // 3. Embed Club Logo (Shield) on the Left
      let logoImage;
      let logoWidth = 0;
      let logoHeight = 46;
      
      if (organizationSettings?.club_logo_url) {
        try {
          const logoResp = await fetch(organizationSettings.club_logo_url);
          const logoBuffer = await logoResp.arrayBuffer();
          try {
            logoImage = await pdfDoc.embedPng(logoBuffer);
          } catch {
            logoImage = await pdfDoc.embedJpg(logoBuffer);
          }
          
          if (logoImage) {
            const logoRatio = logoImage.width / logoImage.height;
            logoWidth = logoHeight * logoRatio;
            
            page.drawImage(logoImage, {
              x: leftMargin,
              y: pageHeight - topMargin - logoHeight + 1,
              width: logoWidth,
              height: logoHeight,
            });
          }
        } catch (err) {
          console.error("CORS or format issue when embedding club logo:", err);
        }
      }
      
      // Fallback spacing in case logo did not load
      if (logoWidth === 0) {
        logoWidth = 35;
      }
      
      // 4. Draw Header Metadata on the right of the logo
      const textX = leftMargin + logoWidth + 12;
      const baseHeaderY = pageHeight - topMargin;
      
      // Line 1: Club Name (SD Almazán)
      page.drawText(organizationSettings?.club_name || "SD Almazán", {
        x: textX,
        y: baseHeaderY - 10,
        size: 14,
        font: helveticaBoldFont,
        color: rgb(0.06, 0.09, 0.16),
      });
      
      // Line 2: Subtitle (Campograma)
      page.drawText("Campograma", {
        x: textX,
        y: baseHeaderY - 24,
        size: 11,
        font: helveticaBoldFont,
        color: rgb(0.12, 0.16, 0.23),
      });
      
      // Line 3: Season Name
      page.drawText(`Temporada ${activeSeasonName || "2026/27"}`, {
        x: textX,
        y: baseHeaderY - 36,
        size: 9.5,
        font: helveticaFont,
        color: rgb(0.35, 0.4, 0.47),
      });
      
      // Draw horizontal dividing line below header
      const lineY = pageHeight - topMargin - 55;
      page.drawLine({
        start: { x: leftMargin, y: lineY },
        end: { x: pageWidth - leftMargin, y: lineY },
        thickness: 0.8,
        color: rgb(0.85, 0.87, 0.9),
      });

      // 5. Embed Captured Field Map
      const imageBytes = await fetch(dataUrl).then((res) => res.arrayBuffer());
      const fieldImage = await pdfDoc.embedPng(imageBytes);
      
      // Calculate layout positioning (no footer, bottom margin of 30pt)
      const bottomMargin = 30;
      const lineBottomY = lineY - 15;
      const maxImgHeight = lineBottomY - bottomMargin;
      const maxImgWidth = pageWidth - 2 * leftMargin;
      
      const imgRatio = fieldImage.width / fieldImage.height;
      let imgWidth = maxImgWidth;
      let imgHeight = maxImgWidth / imgRatio;
      
      if (imgHeight > maxImgHeight) {
        imgHeight = maxImgHeight;
        imgWidth = maxImgHeight * imgRatio;
      }
      
      const imgX = (pageWidth - imgWidth) / 2;
      const imgY = bottomMargin + (maxImgHeight - imgHeight) / 2;
      
      page.drawImage(fieldImage, {
        x: imgX,
        y: imgY,
        width: imgWidth,
        height: imgHeight,
      });

      // 6. Open PDF Preview Modal
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      setShowPreview(true);
      
    } catch (error) {
      console.error("Error generating Campograma PDF:", error);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start no-print-bg">
      {/* PDF Preview Modal */}
      {showPreview && pdfUrl && (
        <div className="fixed inset-0 bg-background/80 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200 no-print">
          <div className="bg-popover border border-border rounded-xl w-full max-w-4xl h-[85vh] flex flex-col shadow-md overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-slate-950/40">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Vista Previa del Campograma
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Revisa el documento antes de guardarlo o imprimirlo
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Download Button */}
                <a
                  href={pdfUrl}
                  download={`Campograma_${organizationSettings?.club_name || "SD_Almazan"}_${formation}.pdf`}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 text-xs font-bold transition-all cursor-pointer"
                >
                  Descargar PDF
                </a>
                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => {
                    setShowPreview(false);
                    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
                    setPdfUrl(null);
                  }}
                  className="rounded-lg border border-white/10 hover:border-white/20 text-slate-400 hover:text-white px-3 py-1.5 text-xs font-bold transition-all cursor-pointer bg-white/5"
                >
                  Cerrar
                </button>
              </div>
            </div>
            
            {/* Modal Body: PDF Preview Frame */}
            <div className="flex-grow bg-slate-950 p-2">
              <iframe
                src={`${pdfUrl}#toolbar=1`}
                className="w-full h-full rounded-xl border border-white/5"
                title="Vista Previa de Campograma"
              />
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm 10mm 10mm 10mm;
          }
          html, body, #__next, [class*="min-h-screen"], [class*="h-screen"], [class*="h-"], [class*="min-h-"] {
            height: auto !important;
            min-height: 0 !important;
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          body {
            padding: 4mm !important;
          }
          /* Hide non-print elements */
          .no-print, header, nav, aside, button, [data-sidebar], .sidebar-inset > header, .preseason-title-header {
            display: none !important;
          }
          /* Grid columns and map layout centering */
          .no-print-bg {
            zoom: 0.82 !important;
            max-width: 100% !important;
            margin: 0 auto !important;
            background: white !important;
            border: none !important;
            padding: 0 !important;
            box-shadow: none !important;
          }
          .lg\\:col-span-8 {
            width: 100% !important;
            max-width: 580px !important;
            margin: 0 auto !important;
            flex: 1 1 100% !important;
          }
          .grid {
            display: block !important;
          }
          /* Reset container glass and border box shadows */
          .bg-card, .bg-muted\\/50 {
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
          }
          
          /* Solid football field premium green fallback background */
          .no-print-bg [class*="from-\\[oklch"] {
            background: #1E3F20 !important;
            background-color: #1E3F20 !important;
          }
          .no-print-bg svg {
            opacity: 0.65 !important;
          }

          /* Player dots white premium card blocks style on white background */
          .no-print-bg [class*="bg-zinc-950"] {
            background-color: white !important;
            background: white !important;
            border-color: #E2E8F0 !important;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03) !important;
          }
          .no-print-bg [class*="bg-zinc-900"] {
            background-color: #F8FAFC !important;
            background: #F8FAFC !important;
            border-color: #E2E8F0 !important;
          }
          /* Highlight primary position dot labels */
          .no-print-bg button[class*="border-\\[var\\(--primary\\)\\]"] {
            background-color: white !important;
            color: #0F172A !important;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05) !important;
          }

          /* Force high contrast dark texts for player list names inside tactical board in print */
          .no-print-bg [class*="bg-zinc-950"] span {
            color: #0F172A !important;
          }
          .no-print-bg [class*="text-purple-400"] {
            color: #6D28D9 !important; /* Premium deep violet */
          }
          .no-print-bg [class*="text-amber-500"] {
            color: #B45309 !important; /* Premium dark amber */
          }
          .no-print-bg [class*="text-red-500"] {
            color: #B91C1C !important; /* Premium dark red */
          }
          .no-print-bg [class*="text-slate-400"] {
            color: #64748B !important;
          }
          .no-print-bg .text-slate-500,
          .no-print-bg .text-slate-400 {
            color: #64748B !important;
          }
        }
      ` }} />

      {/* Print/A4 Header (Only visible on print) */}
      <div className="hidden print:flex items-center justify-between border-b border-slate-200 pb-4 mb-6 w-full">
        <div>
          <h1 className="text-2xl font-black text-slate-900 leading-tight">
            Campograma {organizationSettings?.club_name || "SD Almazán"}
          </h1>
          <p className="text-sm text-slate-500 font-bold mt-1">
            Temporada {activeSeasonName || "2026/2027"}
          </p>
        </div>
        {organizationSettings?.club_logo_url ? (
          <img
            src={organizationSettings.club_logo_url}
            alt="Escudo"
            className="h-14 w-14 object-contain"
          />
        ) : (
          <div className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
            <Shield className="h-7 w-7 text-slate-400" />
          </div>
        )}
      </div>

      {/* Left Column: Large Tactical Field Map */}
      <div className="lg:col-span-8 w-full max-w-[640px] mx-auto">
        <div className="bg-card rounded-xl p-5 border border-border shadow-md relative">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2 no-print">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Campograma / Plantilla
            </span>
            
            <div className="flex items-center gap-2">
              {/* Toggle Filiales */}
              <button
                type="button"
                onClick={() => setShowFilials(!showFilials)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                  showFilials
                    ? "border-purple-500/30 bg-purple-500/10 text-purple-400"
                    : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
                }`}
              >
                <span>{showFilials ? "Filiales: SÍ" : "Filiales: NO"}</span>
              </button>

              {/* Custom Formations Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setFormationsOpen(!formationsOpen)}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-200 cursor-pointer focus:outline-none hover:bg-white/10 hover:text-white transition-all"
                >
                  <span>Formación: {formation}</span>
                  <ChevronDown className="h-3 w-3 text-slate-400 transition-transform duration-200" style={{ transform: formationsOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
                </button>
                
                {formationsOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setFormationsOpen(false)} />
                    <div className="absolute right-0 mt-1.5 w-36 rounded-lg border border-border bg-popover p-1.5 shadow-md z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                      {FORMATIONS.map((form) => (
                        <button
                          key={form}
                          type="button"
                          onClick={() => {
                            setFormation(form);
                            if (typeof window !== "undefined") {
                              localStorage.setItem("cl_preferred_formation", form);
                            }
                            setFormationsOpen(false);
                          }}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                            formation === form
                              ? "bg-emerald-500/20 text-emerald-450 border border-emerald-500/20"
                              : "text-slate-300 hover:bg-white/5 hover:text-white"
                          }`}
                        >
                          {form}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {selectedPosition && (
                <button
                  type="button"
                  onClick={() => setSelectedPosition(null)}
                  className="text-xs font-bold text-emerald-450 hover:underline px-2 py-1"
                >
                  Ver todos
                </button>
              )}

              {/* Exportar PDF Button */}
              <button
                type="button"
                onClick={exportToPdf}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-200 cursor-pointer focus:outline-none hover:bg-white/10 hover:text-white transition-all ml-1"
                title="Exportar PDF"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Exportar PDF</span>
              </button>
            </div>
          </div>
          
          <div ref={fieldRef} className="relative w-full">
            <FieldMap
              assignments={assignments}
              selectedPosition={selectedPosition}
              interactive={true}
              onPositionClick={handlePositionClick}
              formation={formation}
            />
          </div>
        </div>
      </div>

      {/* Right Column: Single Column Roster List */}
      <div className="lg:col-span-4 space-y-3 w-full no-print">
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <h2 className="text-xs font-bold text-slate-455 uppercase tracking-wider">
            {selectedPosition
              ? `${getPositionLabel(selectedPosition)} (${sortedPlayers.length})`
              : `Todos los jugadores (${sortedPlayers.length})`}
          </h2>
        </div>

        <div className="space-y-2.5 max-h-[920px] overflow-y-auto pr-1 premium-scrollbar">
          {sortedPlayers.length === 0 ? (
            <p className="text-sm text-slate-500 italic py-10 text-center">
              No hay jugadores asignados a esta posición
            </p>
          ) : (
            sortedPlayers.map((p) => {
              const name = p.sporting_name || `${p.first_name} ${p.last_name}`;
              const initials = p.sporting_name ? p.sporting_name.substring(0, 2).toUpperCase() : `${p.first_name[0] || ""}${p.last_name[0] || ""}`.toUpperCase();
              const primary = p.membership?.positions?.[0];
              const secondaries = p.membership?.positions?.slice(1) ?? [];
              const birthYear = p.date_of_birth ? new Date(p.date_of_birth).getFullYear() : null;
              const activeStartYear = p.membership?.seasons?.start_date
                ? new Date(p.membership.seasons.start_date).getFullYear()
                : new Date().getFullYear();
              const sub23Limit = activeStartYear - 22;
              const isSub23 = birthYear && (birthYear >= sub23Limit);
              const isInactive = p.membership?.status === "inactive";
              const isReserve = p.membership?.player_type === "reserve";
              const isYouth = p.membership?.player_type === "youth";
              const isOther = p.membership?.player_type === "other";

              let typeLabel = "";
              let borderClass = "border-white/5 bg-white/2 hover:border-white/10";
              if (isReserve) {
                borderClass = "border-sky-500/20 bg-sky-500/5 hover:border-sky-500/45";
                typeLabel = p.membership?.player_type_label || "Filial";
              } else if (isYouth) {
                borderClass = "border-purple-500/20 bg-purple-500/5 hover:border-purple-500/45";
                typeLabel = p.membership?.player_type_label || "Juvenil";
              } else if (isOther) {
                borderClass = "border-indigo-500/20 bg-indigo-500/5 hover:border-indigo-500/45";
                typeLabel = p.membership?.player_type_label || "Otro";
              }

              return (
                <Link
                  key={p.id}
                  href={`/players/${p.id}`}
                  className={cn(
                    "flex flex-col gap-2 p-3.5 rounded-lg border border-border transition-all bg-muted/50",
                    borderClass,
                    isInactive && "opacity-45 grayscale"
                  )}
                >
                  <div className="flex items-center justify-between min-w-0 gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Avatar */}
                      {p.avatar_url ? (
                        <img
                          src={p.avatar_url}
                          alt={name}
                          className="h-10 w-10 rounded-xl object-cover shrink-0 border border-white/10"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-white font-bold text-xs shrink-0 border border-white/10">
                          {initials}
                        </div>
                      )}

                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white leading-tight truncate">
                          {name} {p.membership?.jersey_number != null && `#${p.membership.jersey_number}`}
                        </p>
                        
                        <div className="flex flex-wrap items-center gap-1 mt-1.5">
                          {primary && (
                            <span className="text-[11.5px] font-bold corp-badge border border-[var(--corp-border-strong)] rounded px-1.5 py-0.5 leading-none">
                              {getPositionLabel(primary)}
                            </span>
                          )}
                          {secondaries.length > 0 &&
                            secondaries.slice(0, 2).map((sec) => (
                              <span
                                key={sec}
                                className="text-[11.5px] font-medium bg-slate-800/80 text-slate-400 border border-white/5 rounded px-1.5 py-0.5 leading-none"
                              >
                                {getPositionLabel(sec)}
                              </span>
                            ))}
                        </div>
                      </div>
                    </div>

                    {typeLabel && (
                      <span className={cn(
                        "text-[9.5px] font-extrabold border rounded-lg px-2 py-0.5 uppercase tracking-widest shrink-0",
                        isReserve && "bg-sky-500/10 text-sky-400 border-sky-500/25",
                        isYouth && "bg-purple-500/10 text-purple-400 border-purple-500/25",
                        isOther && "bg-indigo-500/10 text-indigo-400 border-indigo-500/25"
                      )}>
                        {typeLabel}
                      </span>
                    )}
                  </div>

                  {/* Details row (adjective, birthYear, labels) */}
                  <div className="flex items-center justify-between border-t border-white/5 pt-2 mt-1 text-[11px] text-slate-500">
                    <div className="flex items-center gap-1.5">
                      {isSub23 && (
                        <span className="text-[10.5px] font-extrabold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-md px-1.5 py-0.5 leading-none uppercase tracking-wider">
                          Sub-23
                        </span>
                      )}
                      {p.adjective && (
                        <span className="text-[10.5px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-md px-1.5 py-0.5 leading-none">
                          {p.adjective}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1 font-medium text-[11px]">
                      <CalendarDays className="h-3 w-3 text-slate-600" />
                      <span>{birthYear ? `Nac. ${birthYear}` : "—"}</span>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>

      {/* Off-screen hidden print target clone (Only used for PDF capturing) */}
      <div className="absolute -left-[9999px] -top-[9999px] pointer-events-none w-[640px] h-[896px] bg-[#1E3F20] overflow-hidden rounded-2xl flex flex-col justify-center p-3">
        <div ref={printFieldRef} className="w-full">
          <FieldMap
            assignments={assignments}
            selectedPosition={null}
            interactive={false}
            formation={formation}
            printMode={true}
          />
        </div>
      </div>
    </div>
  );
}
