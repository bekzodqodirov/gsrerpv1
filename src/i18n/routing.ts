import { defineRouting } from "next-intl/routing";
import { createNavigation } from "next-intl/navigation";
import { locales, defaultLocale } from "./config";

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "as-needed",
  // Brauzer tiliga qarab avtomatik almashtirmaymiz — asosiy til o'zbekcha,
  // foydalanuvchi tanlagani NEXT_LOCALE cookie orqali saqlanadi.
  localeDetection: false,
});

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
