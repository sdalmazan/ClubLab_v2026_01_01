import type { Metadata } from "next";
import { LanguageSelector } from "@/components/layout/LanguageSelector";

export const metadata: Metadata = {
  title: "Acceso",
  description: "Inicia sesión en ClubLab",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[oklch(10%_0.02_265)] relative overflow-hidden">
      {/* Top right language selector */}
      <div className="absolute top-4 right-4 z-50">
        <LanguageSelector />
      </div>
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%, oklch(70%_0.18_162_/_0.12) 0%, transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 100% 100%, oklch(62%_0.17_265_/_0.07) 0%, transparent 70%)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 w-full max-w-md px-4">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[oklch(70%_0.18_162)] to-[oklch(50%_0.16_162)] flex items-center justify-center shadow-lg shadow-[oklch(70%_0.18_162_/_0.3)] mb-4">
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
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            ClubLab
          </h1>
          <p className="text-[oklch(57%_0.03_265)] text-xs font-medium tracking-widest uppercase mt-0.5">
            Sports Management Platform
          </p>
        </div>

        {children}
      </div>
    </div>
  );
}
