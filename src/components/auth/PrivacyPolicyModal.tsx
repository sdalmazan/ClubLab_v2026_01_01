"use client";

import { X, ShieldCheck } from "lucide-react";

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PrivacyPolicyModal({ isOpen, onClose }: PrivacyPolicyModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl max-h-[85vh] bg-[#111827] border border-border/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/60 bg-accent/20">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
            <h3 className="text-base font-bold text-white">Política de Privacidad y Protección de Datos</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-300 leading-relaxed">
          <p className="font-semibold text-slate-200">
            Última actualización: 2026 | Cumplimiento RGPD (UE 2016/679) y LOPDGDD 3/2018.
          </p>

          <section className="space-y-1.5">
            <h4 className="font-bold text-sm text-emerald-400">1. Responsable del Tratamiento</h4>
            <p>
              ClubLab Software S.L. ("ClubLab") actúa como Encargado y/o Responsable del Tratamiento de los datos de carácter personal recabados a través de esta plataforma.
            </p>
          </section>

          <section className="space-y-1.5">
            <h4 className="font-bold text-sm text-emerald-400">2. Datos Recabados y Finalidad</h4>
            <p>
              Recabamos datos identificativos (nombre, correo electrónico), datos deportivos y métricas de rendimiento/wellness con las siguientes finalidades:
            </p>
            <ul className="list-disc pl-4 space-y-1 text-slate-400">
              <li>Gestión de la plantilla deportiva, entrenamientos y análisis táctico del club.</li>
              <li>Seguimiento del estado físico, control de cargas y prevención de lesiones.</li>
              <li>Envío de notificaciones y alertas operativas relacionadas con la actividad del club.</li>
            </ul>
          </section>

          <section className="space-y-1.5">
            <h4 className="font-bold text-sm text-emerald-400">3. Base Jurídica y Consentimiento</h4>
            <p>
              El tratamiento de datos se fundamenta en la ejecución del contrato de prestación de servicios y en el consentimiento explícito otorgado en este acto. La aceptación se registra electrónicamente con marca temporal e IP para garantizar el cumplimiento normativo.
            </p>
          </section>

          <section className="space-y-1.5">
            <h4 className="font-bold text-sm text-emerald-400">4. Seudonimización y Canal IA</h4>
            <p>
              Ningún dato identificativo directo (como nombres completos o correos) se transmite a modelos de inteligencia artificial de terceros. Las canalizaciones de datos IA utilizan identificadores seudonimizados.
            </p>
          </section>

          <section className="space-y-1.5">
            <h4 className="font-bold text-sm text-emerald-400">5. Derechos ARCO / RGPD</h4>
            <p>
              Puedes ejercitar en cualquier momento tus derechos de acceso, rectificación, supresión, limitación y portabilidad enviando una solicitud a través de los ajustes de tu perfil o al correo <code>privacy@clublab.app</code>.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border/60 bg-accent/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-colors shadow-md shadow-emerald-950/40"
          >
            Entendido y cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
