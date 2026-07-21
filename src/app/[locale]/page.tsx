import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { locales, localeNames, type Locale } from "@/i18n/config";
import { Link } from "@/i18n/routing";

export default function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("home");
  const nav = useTranslations("nav");

  const modules = [
    { key: "inventory", href: "/inventory" },
    { key: "sales", href: "/sales" },
    { key: "finance", href: "/finance" },
    { key: "hr", href: "/hr" },
    { key: "settings", href: "/settings" },
  ] as const;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold">{t("title")}</h1>
        <p className="mt-2 text-lg text-gray-500">{t("subtitle")}</p>
      </div>

      <nav className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {modules.map((m) => (
          <div
            key={m.key}
            className="rounded-lg border border-gray-200 px-6 py-4 text-center font-medium dark:border-gray-700"
          >
            {nav(m.key)}
          </div>
        ))}
      </nav>

      <div className="flex gap-3 text-sm">
        {locales.map((l: Locale) => (
          <Link
            key={l}
            href="/"
            locale={l}
            className={
              l === locale
                ? "font-bold underline"
                : "text-gray-500 hover:underline"
            }
          >
            {localeNames[l]}
          </Link>
        ))}
      </div>
    </main>
  );
}
