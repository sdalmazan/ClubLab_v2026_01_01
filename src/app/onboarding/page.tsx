import type { Metadata } from "next";
import { OnboardingWizard } from "./OnboardingWizard";

export const metadata: Metadata = {
  title: "Configura tu organización — ClubLab",
  description: "Configura tu club o academia para empezar a usar ClubLab",
};

export default function OnboardingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[oklch(10%_0.02_265)] relative overflow-hidden px-4 py-12">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%, oklch(70%_0.18_162_/_0.1) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 w-full max-w-lg">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[oklch(70%_0.18_162)] to-[oklch(50%_0.16_162)] flex items-center justify-center shadow-lg shadow-[oklch(70%_0.18_162_/_0.3)] mb-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m6.5 6.5 11 11" />
              <path d="m21 21-1-1" />
              <path d="m3 3 1 1" />
              <path d="m18 22 4-4" />
              <path d="m2 6 4-4" />
              <path d="m3 10 7-7" />
              <path d="m14 21 7-7" />
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold text-white">Bienvenido a ClubLab</h1>
          <p className="text-slate-400 text-sm mt-1">Configura tu organización para empezar</p>
        </div>

        <OnboardingWizard />
      </div>
    </div>
  );
}
