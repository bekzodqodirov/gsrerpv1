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
  // Dev-server'ga telefondan (LAN IP orqali, masalan kamera test qilish uchun
  // npm run dev:https) kirilganda Next.js standart holatda faqat "localhost"
  // manzilidan kelgan so'rovlarga ruxsat beradi — boshqa barcha manzillar
  // uchun JS bundle (_next/*) so'rovlari 403 bilan bloklanadi va sahifa
  // umuman hydrate bo'lmaydi (tugmalar, kamera — hech narsa ishlamaydi).
  // Uy/ofis LAN tarmoqlarining odatiy manzil oralig'ini ruxsat beramiz.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
};

export default withNextIntl(nextConfig);
