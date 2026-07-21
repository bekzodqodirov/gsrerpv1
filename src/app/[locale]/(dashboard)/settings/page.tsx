import { getTranslations } from "next-intl/server";
import { getSession } from "@/modules/shared/auth";
import { Link } from "@/i18n/routing";

export default async function SettingsPage() {
  const t = await getTranslations("settings");
  const nav = await getTranslations("nav");
  const session = await getSession();
  const canUsers =
    session?.perms.includes("*") ||
    session?.perms.includes("settings.users.manage");

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">{nav("settings")}</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {canUsers && (
          <Link
            href="/settings/users"
            className="rounded-lg border border-gray-200 p-5 hover:border-blue-400 hover:shadow-sm dark:border-gray-700 dark:hover:border-blue-500"
          >
            <div className="font-semibold">{t("users")}</div>
            <p className="mt-1 text-sm text-gray-500">{t("usersDesc")}</p>
          </Link>
        )}
      </div>
    </main>
  );
}
