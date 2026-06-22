import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { readFileSync } from "fs";
import { resolve } from "path";

// Force load and override env variables from .env.local to prevent system-wide hijack
try {
  const envPath = resolve(process.cwd(), ".env.local");
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    process.env[key] = val;
  }
  console.log("=========================================");
  console.log("🛠️  ClubLab Startup Config:");
  console.log("   NEXT_PUBLIC_SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log("=========================================");
} catch (e: any) {
  // Silently ignore if file doesn't exist
}

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Image optimisation — add external hosts as needed
  images: {
    remotePatterns: [],
  },
  // Strict mode for catching issues early
  reactStrictMode: true,
};

export default withNextIntl(nextConfig);
