import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

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
