import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Yuk qabul qilishda bir nechta karobka rasmlari yuboriladi —
      // standart 1 MB limit yetmaydi.
      bodySizeLimit: "25mb",
    },
  },
};

export default withNextIntl(nextConfig);
