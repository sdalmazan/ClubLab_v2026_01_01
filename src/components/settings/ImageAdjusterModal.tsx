"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Building2, Eye, ShieldAlert, Sparkles, Sliders, Check, FileText } from "lucide-react";

interface ImageAdjusterModalProps {
  file: File;
  onClose: () => void;
  onConfirm: (blob: Blob) => Promise<void>;
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

export default function ImageAdjusterModal({ file, onClose, onConfirm }: ImageAdjusterModalProps) {
  const [removeBg, setRemoveBg] = useState(true);
  const [tolerance, setTolerance] = useState(40);
  const [paddingPercent, setPaddingPercent] = useState(10);
  const [detectedColor, setDetectedColor] = useState<RGB>({ r: 255, g: 255, b: 255 });
  const [customColor, setCustomColor] = useState<RGB | null>(null);
  
  const [imageLoaded, setImageLoaded] = useState(false);
  const [originalUrl, setOriginalUrl] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Refs for tracking image dimensions and DOM elements
  const imgRef = useRef<HTMLImageElement | null>(null);
  const originalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const targetCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Load the original image file
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setOriginalUrl(url);

    const img = new Image();
    img.src = url;
    img.onload = () => {
      // Downscale if very large to prevent lag in processing
      let w = img.width;
      let h = img.height;
      const MAX_DIM = 800;
      if (w > MAX_DIM || h > MAX_DIM) {
        if (w > h) {
          h = Math.round((h * MAX_DIM) / w);
          w = MAX_DIM;
        } else {
          w = Math.round((w * MAX_DIM) / h);
          h = MAX_DIM;
        }
      }

      setDimensions({ width: w, height: h });
      imgRef.current = img;

      // Draw original on hidden canvas to sample colors
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, w, h);
        originalCanvasRef.current = canvas;

        // Detect background color by averaging corners
        const corners = [
          ctx.getImageData(0, 0, 1, 1).data, // top-left
          ctx.getImageData(w - 1, 0, 1, 1).data, // top-right
          ctx.getImageData(0, h - 1, 1, 1).data, // bottom-left
          ctx.getImageData(w - 1, h - 1, 1, 1).data, // bottom-right
        ];

        const avgColor = {
          r: Math.round(corners.reduce((sum, c) => sum + c[0], 0) / 4),
          g: Math.round(corners.reduce((sum, c) => sum + c[1], 0) / 4),
          b: Math.round(corners.reduce((sum, c) => sum + c[2], 0) / 4),
        };

        setDetectedColor(avgColor);
      }
      setImageLoaded(true);
    };

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  // Process image on changes
  useEffect(() => {
    if (!imageLoaded || !imgRef.current || !dimensions.width) return;

    setIsProcessing(true);
    const processTimeout = setTimeout(() => {
      processImage();
      setIsProcessing(false);
    }, 100); // Debounce slightly

    return () => clearTimeout(processTimeout);
  }, [imageLoaded, removeBg, tolerance, paddingPercent, customColor, dimensions]);

  const processImage = () => {
    const W = dimensions.width;
    const H = dimensions.height;

    // Create primary workspace canvas
    const workCanvas = document.createElement("canvas");
    workCanvas.width = W;
    workCanvas.height = H;
    const workCtx = workCanvas.getContext("2d");
    if (!workCtx || !imgRef.current) return;

    // Draw the image
    workCtx.drawImage(imgRef.current, 0, 0, W, H);
    
    // Perform background removal if active
    let minX = 0, minY = 0, maxX = W - 1, maxY = H - 1;

    if (removeBg) {
      const imgData = workCtx.getImageData(0, 0, W, H);
      const data = imgData.data;

      // Color to remove
      const targetColor = customColor || detectedColor;

      // BFS Queue for border-based flood fill
      const visited = new Uint8Array(W * H);
      const queue: number[] = [];

      // Add all border pixels to queue
      for (let x = 0; x < W; x++) {
        queue.push(x, 0);
        queue.push(x, H - 1);
      }
      for (let y = 1; y < H - 1; y++) {
        queue.push(0, y);
        queue.push(W - 1, y);
      }

      let head = 0;
      while (head < queue.length) {
        const x = queue[head++];
        const y = queue[head++];
        const idx = y * W + x;

        if (visited[idx]) continue;
        visited[idx] = 1;

        const pixelStart = idx * 4;
        const r = data[pixelStart];
        const g = data[pixelStart + 1];
        const b = data[pixelStart + 2];
        const a = data[pixelStart + 3];

        // Color distance formula (Euclidean distance in RGB space)
        const colorDist = Math.sqrt(
          (r - targetColor.r) ** 2 +
          (g - targetColor.g) ** 2 +
          (b - targetColor.b) ** 2
        );

        // If the color matches the target background color and is not already transparent
        if (colorDist <= tolerance && a > 0) {
          data[pixelStart + 3] = 0; // Make transparent

          // Add neighbors (4-connectivity)
          if (x > 0 && !visited[y * W + (x - 1)]) queue.push(x - 1, y);
          if (x < W - 1 && !visited[y * W + (x + 1)]) queue.push(x + 1, y);
          if (y > 0 && !visited[(y - 1) * W + x]) queue.push(x, y - 1);
          if (y < H - 1 && !visited[(y + 1) * W + x]) queue.push(x, y + 1);
        }
      }

      // Put the modified image data back
      workCtx.putImageData(imgData, 0, 0);

      // Find the bounding box of non-transparent pixels (Trim)
      let foundOpaque = false;
      let left = W, top = H, right = 0, bottom = 0;

      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const idx = (y * W + x) * 4;
          const a = data[idx + 3];
          if (a > 10) { // Opaque pixel threshold
            if (x < left) left = x;
            if (x > right) right = x;
            if (y < top) top = y;
            if (y > bottom) bottom = y;
            foundOpaque = true;
          }
        }
      }

      if (foundOpaque) {
        minX = left;
        minY = top;
        maxX = right;
        maxY = bottom;
      }
    }

    const cropW = maxX - minX + 1;
    const cropH = maxY - minY + 1;

    // Create high-res destination canvas (512x512 is ideal for profile / sidebar / prints)
    const targetSize = 512;
    const destCanvas = document.createElement("canvas");
    destCanvas.width = targetSize;
    destCanvas.height = targetSize;
    const destCtx = destCanvas.getContext("2d");
    if (!destCtx) return;

    // Draw transparent background
    destCtx.clearRect(0, 0, targetSize, targetSize);

    // Calculate scaling with safety margins
    const padPx = targetSize * (paddingPercent / 100);
    const availableSize = targetSize - 2 * padPx;

    const scale = Math.min(availableSize / cropW, availableSize / cropH);
    const targetW = cropW * scale;
    const targetH = cropH * scale;

    const dx = (targetSize - targetW) / 2;
    const dy = (targetSize - targetH) / 2;

    // Draw the cropped portion with linear interpolation for high-quality downscaling
    destCtx.imageSmoothingEnabled = true;
    destCtx.imageSmoothingQuality = "high";
    destCtx.drawImage(workCanvas, minX, minY, cropW, cropH, dx, dy, targetW, targetH);

    // Update target canvas ref and preview URL
    targetCanvasRef.current = destCanvas;
    setPreviewUrl(destCanvas.toDataURL("image/png"));
  };

  // Sample custom background color on clicking the original preview
  const handleOriginalImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!originalCanvasRef.current || !dimensions.width) return;
    
    const img = e.currentTarget;
    const rect = img.getBoundingClientRect();
    
    // Map click coordinates to downscaled canvas dimensions
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * dimensions.width);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * dimensions.height);
    
    const ctx = originalCanvasRef.current.getContext("2d");
    if (ctx) {
      const pixel = ctx.getImageData(x, y, 1, 1).data;
      setCustomColor({
        r: pixel[0],
        g: pixel[1],
        b: pixel[2],
      });
      setRemoveBg(true);
    }
  };

  const handleResetColor = () => {
    setCustomColor(null);
  };

  const handleSave = async () => {
    if (!targetCanvasRef.current || isSubmitting) return;

    setIsSubmitting(true);
    try {
      targetCanvasRef.current.toBlob(async (blob) => {
        if (blob) {
          await onConfirm(blob);
        } else {
          console.error("No se pudo generar el blob de la imagen.");
        }
        setIsSubmitting(false);
      }, "image/png");
    } catch (err) {
      console.error("Error al guardar la imagen procesada:", err);
      setIsSubmitting(false);
    }
  };

  const activeColor = customColor || detectedColor;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in">
      <div className="flex flex-col w-full max-w-4xl h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-none">Ajustar Escudo / Logotipo</h3>
              <p className="text-xs text-slate-400 mt-1">Prepara automáticamente la imagen para perfiles e informes impresos</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-slate-800 overflow-y-auto md:overflow-hidden">
          
          {/* Left panel: Image Viewports */}
          <div className="md:col-span-3 p-6 flex flex-col items-center justify-center gap-5 overflow-y-auto bg-slate-950/40 w-full">
            
            {/* The main workspace canvas preview */}
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Escudo Procesado</span>
              <div 
                className="relative w-28 h-28 rounded-2xl border border-slate-800 flex items-center justify-center overflow-hidden shadow-inner bg-slate-900 shadow-black/80 shrink-0"
                style={{
                  backgroundImage: "radial-gradient(#1e293b 25%, transparent 25%), radial-gradient(#1e293b 25%, #0f172a 25%)",
                  backgroundSize: "16px 16px",
                  backgroundPosition: "0 0, 8px 8px",
                }}
              >
                {isProcessing && (
                  <div className="absolute inset-0 bg-black/45 backdrop-blur-xs flex items-center justify-center z-10">
                    <span className="text-[9px] font-semibold text-emerald-400 animate-pulse">Procesando...</span>
                  </div>
                )}
                {previewUrl ? (
                  <img src={previewUrl} className="max-h-full max-w-full object-contain p-1.5" alt="Preview" />
                ) : (
                  <Building2 className="h-8 w-8 text-slate-700 animate-pulse" />
                )}
              </div>
              <span className="text-[9px] text-slate-450 font-medium">Lienzo 1:1 transparente (512x512)</span>
            </div>

            {/* Clickable Original Thumbnail */}
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Imagen Original (Clic para gotero)</span>
              <div className="relative w-24 h-24 rounded-xl border border-slate-800 bg-black/40 overflow-hidden cursor-crosshair group flex items-center justify-center shrink-0">
                {originalUrl && (
                  <img 
                    src={originalUrl} 
                    onClick={handleOriginalImageClick}
                    className="max-h-full max-w-full object-contain select-none opacity-85 hover:opacity-100 transition-opacity" 
                    alt="Original" 
                  />
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity pointer-events-none">
                  <span className="text-[8px] bg-slate-900/90 border border-slate-700 text-slate-200 px-1 py-0.5 rounded font-bold uppercase">Gotero</span>
                </div>
              </div>
            </div>

          </div>

          {/* Right panel: Controls and Real Previews */}
          <div className="md:col-span-2 p-6 flex flex-col gap-6 overflow-y-auto max-h-full w-full">
            
            {/* Control Sliders Section */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-450 uppercase tracking-widest flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5" /> Ajustes de Imagen
              </h4>

              {/* Background removal toggle */}
              <div className="flex items-center justify-between p-3 bg-white/2 border border-white/5 rounded-xl">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-white">Eliminar fondo exterior</span>
                  <p className="text-[10px] text-slate-405">Quita el fondo sólido de los bordes</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={removeBg} 
                    onChange={(e) => setRemoveBg(e.target.checked)}
                    className="sr-only peer" 
                  />
                  <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-350 after:border-slate-350 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>

              {/* Background Color Indicator and Reset */}
              {removeBg && (
                <div className="space-y-3.5 p-3.5 bg-white/2 border border-white/5 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">Fondo a eliminar:</span>
                    <div className="flex items-center gap-2">
                      <div 
                        className="h-4 w-8 rounded border border-white/20 shadow"
                        style={{ backgroundColor: `rgb(${activeColor.r}, ${activeColor.g}, ${activeColor.b})` }}
                      />
                      <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">
                        #{activeColor.r.toString(16).padStart(2,'0')}{activeColor.g.toString(16).padStart(2,'0')}{activeColor.b.toString(16).padStart(2,'0')}
                      </span>
                    </div>
                  </div>
                  
                  {customColor && (
                    <button 
                      onClick={handleResetColor}
                      className="w-full text-center text-[10px] text-emerald-400 font-bold hover:underline"
                    >
                      Restablecer color automático
                    </button>
                  )}

                  {/* Tolerance slider */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-[10px] font-bold text-slate-450 uppercase">
                      <span>Tolerancia de color</span>
                      <span>{tolerance}</span>
                    </div>
                    <input 
                      type="range" 
                      min="5" 
                      max="130" 
                      value={tolerance} 
                      onChange={(e) => setTolerance(parseInt(e.target.value))}
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                    <p className="text-[9px] text-slate-500 leading-normal">
                      Aumenta si quedan bordes del fondo. Reduce si se eliminan partes del escudo.
                    </p>
                  </div>
                </div>
              )}

              {/* Safe Margin slider */}
              <div className="space-y-1.5 p-3.5 bg-white/2 border border-white/5 rounded-xl">
                <div className="flex justify-between text-[10px] font-bold text-slate-450 uppercase">
                  <span>Margen de seguridad</span>
                  <span>{paddingPercent}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="30" 
                  value={paddingPercent} 
                  onChange={(e) => setPaddingPercent(parseInt(e.target.value))}
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <p className="text-[9px] text-slate-500 leading-normal">
                  Añade espacio transparente alrededor del escudo para evitar que se recorte en círculos o informes.
                </p>
              </div>

            </div>

            {/* Previews Context Section */}
            <div className="space-y-3.5 pt-2 border-t border-slate-800">
              <h4 className="text-xs font-bold text-slate-450 uppercase tracking-widest flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5" /> Previsualizar en la App
              </h4>
              
              <div className="grid grid-cols-1 gap-3.5">
                
                {/* 1. Sidebar Preview */}
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-white border border-white/10 p-0.5 overflow-hidden flex items-center justify-center shrink-0">
                    {previewUrl ? (
                      <img src={previewUrl} className="h-full w-full object-contain" alt="Sidebar preview" />
                    ) : (
                      <Building2 className="h-4 w-4 text-slate-500" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Menú Lateral</span>
                    <h5 className="text-[11px] font-bold text-white truncate">S.D. Almazán</h5>
                  </div>
                </div>

                {/* 2. Round Avatar Preview */}
                <div className="p-3 bg-white/2 border border-white/5 rounded-xl flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full border border-slate-700 bg-slate-900 overflow-hidden flex items-center justify-center shrink-0">
                    {previewUrl ? (
                      <img src={previewUrl} className="h-full w-full object-contain p-1" alt="Avatar preview" />
                    ) : (
                      <Building2 className="h-5 w-5 text-slate-500" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Perfil Circular (Avatar)</span>
                    <p className="text-[10px] text-slate-400 leading-tight">Así se recortará en la cuenta</p>
                  </div>
                </div>

                {/* 3. Official Printable Report Mock */}
                <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center gap-3 text-slate-900">
                  <div className="h-10 w-10 border border-slate-350 bg-white p-0.5 overflow-hidden flex items-center justify-center shrink-0">
                    {previewUrl ? (
                      <img src={previewUrl} className="h-full w-full object-contain" alt="Report preview" />
                    ) : (
                      <Building2 className="h-5 w-5 text-slate-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 border-l border-slate-200 pl-3">
                    <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider block">Cabecera de Informe PDF</span>
                    <h5 className="text-[10px] font-extrabold text-slate-800 leading-none">CLUB LAB - INFORME OFICIAL</h5>
                    <p className="text-[8px] text-slate-400 mt-0.5 font-bold uppercase">S.D. ALMAZÁN</p>
                  </div>
                  <div className="shrink-0 text-slate-400">
                    <FileText className="h-5 w-5" />
                  </div>
                </div>

              </div>
            </div>

          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800 shrink-0 bg-slate-900/50">
          <button 
            type="button" 
            onClick={onClose} 
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold hover:bg-white/5 rounded-xl transition-colors text-slate-300 hover:text-white"
          >
            Cancelar
          </button>
          <button 
            type="button" 
            onClick={handleSave} 
            disabled={isSubmitting || isProcessing || !previewUrl}
            className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/40 text-white rounded-xl shadow-lg shadow-emerald-500/20 disabled:shadow-none transition-all disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Subiendo...</span>
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>Confirmar y Guardar</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
