"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter, type Locale } from "@/i18n/routing";
import { Globe, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function LanguageSelector() {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();

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
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent transition-all focus:outline-none cursor-pointer">
        <Globe className="h-3.5 w-3.5 opacity-70" />
        <span className="mr-1">{currentLanguage.flag}</span>
        <span className="hidden sm:inline">{currentLanguage.name}</span>
        <ChevronDown className="h-3 w-3 opacity-50" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-40">
        {Object.entries(languages).map(([key, value]) => (
          <DropdownMenuItem
            key={key}
            onSelect={() => handleSelect(key as Locale)}
            className={`w-full flex items-center gap-3 cursor-pointer ${
              locale === key ? "font-bold text-foreground" : "text-muted-foreground"
            }`}
          >
            <span>{value.flag}</span>
            <span>{value.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
