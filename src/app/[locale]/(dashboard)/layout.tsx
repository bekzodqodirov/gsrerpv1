import { getTranslations } from "next-intl/server";
import { getSession } from "@/modules/shared/auth";
import { Link } from "@/i18n/routing";
import { locales, localeNames } from "@/i18n/config";
import { logoutAction } from "./actions";

const NAV_ITEMS = [
  { key: "dashboard", href: "/" },
  { key: "cargo", href: "/cargo" },
  { key: "clients", href: "/clients" },
  { key: "finance", href: "/finance" },
  { key: "hr", href: "/hr" },
  { key: "settings", href: "/settings" },
] as const;

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();
  const nav = await getTranslations("nav");
  const t = await getTranslations("common");

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 flex-col border-r border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900 print:hidden">
        <div className="border-b border-gray-200 p-4 dark:border-gray-700">
          <span className="text-lg font-bold">{t("appName")}</span>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-800"
            >
              {nav(item.key)}
            </Link>
          ))}
        </nav>

        <div className="border-t border-gray-200 p-3 dark:border-gray-700">
          <div className="flex gap-2 px-1 pb-3 text-xs">
            {locales.map((l) => (
              <Link
                key={l}
                href="/"
                locale={l}
                className="text-gray-500 hover:underline"
              >
                {localeNames[l]}
              </Link>
            ))}
          </div>
          <div className="truncate px-1 text-sm font-medium">
            {session?.fullName}
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="mt-2 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-200 dark:border-gray-600 dark:hover:bg-gray-800"
            >
              {nav("logout")}
            </button>
          </form>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
