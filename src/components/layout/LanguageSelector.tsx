"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { usePathname, useRouter, type Locale } from "@/i18n/routing";
import { Globe, ChevronDown } from "lucide-react";

export function LanguageSelector() {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const languages: Record<Locale, { name: string; flag: string }> = {
    es: { name: "Español", flag: "🇪🇸" },
    en: { name: "English", flag: "🇬🇧" },
    pt: { name: "Português", flag: "🇵🇹" },
    fr: { name: "Français", flag: "🇫🇷" },
    it: { name: "Italiano", flag: "🇮🇹" },
    de: { name: "Deutsch", flag: "🇩🇪" },
    nl: { name: "Nederlands", flag: "🇳🇱" },
  };

  const currentLanguage = languages[locale] || languages.es;

  const handleSelect = (newLocale: Locale) => {
    router.replace(pathname, { locale: newLocale });
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-left z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition-all focus:outline-none cursor-pointer"
      >
        <Globe className="h-3.5 w-3.5 text-emerald-500" />
        <span className="mr-1">{currentLanguage.flag}</span>
        <span className="hidden sm:inline">{currentLanguage.name}</span>
        <ChevronDown className={`h-3 w-3 text-slate-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <>
          {/* Overlay to close */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          
          <div className="absolute right-0 mt-2 w-40 rounded-xl bg-zinc-950/90 border border-white/10 p-1.5 shadow-xl backdrop-blur-md z-50 animate-fade-in">
            {Object.entries(languages).map(([key, value]) => (
              <button
                key={key}
                onClick={() => handleSelect(key as Locale)}
                className={`w-full flex items-center gap-3 rounded-lg px-2.5 py-1.5 text-xs text-left transition-colors cursor-pointer ${
                  locale === key
                    ? "bg-emerald-500/10 text-emerald-400 font-bold"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <span>{value.flag}</span>
                <span>{value.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
