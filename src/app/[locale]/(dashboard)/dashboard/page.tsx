import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "ClubLab platform overview",
};

export default function DashboardPage() {
  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-white tracking-tight">
          Bienvenido a{" "}
          <span className="text-gradient-brand">ClubLab</span>
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Plataforma de gestión deportiva
        </p>
      </div>

      {/* Placeholder cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Jugadores activos", value: "—", color: "emerald" },
          { label: "Sesiones esta semana", value: "—", color: "indigo" },
          { label: "Alertas abiertas", value: "—", color: "amber" },
          { label: "Lesiones activas", value: "—", color: "rose" },
        ].map((card) => (
          <div
            key={card.label}
            className="glass-card rounded-2xl p-5 flex flex-col gap-2 animate-fade-in"
          >
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {card.label}
            </span>
            <span className="text-3xl font-extrabold text-white">
              {card.value}
            </span>
          </div>
        ))}
      </div>

      {/* Coming soon notice */}
      <div className="mt-10 glass rounded-2xl p-6 text-center">
        <p className="text-slate-400 text-sm">
          🚧 El dashboard completo se construirá en la{" "}
          <strong className="text-white">Fase 2</strong> con datos reales de tu organización.
        </p>
      </div>
    </div>
  );
}
