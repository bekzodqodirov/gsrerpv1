import { getTranslations } from "next-intl/server";
import { getSession } from "@/modules/shared/auth";
import { Link } from "@/i18n/routing";
import { Card, PageHeader } from "@/components/ui";
import { icons } from "@/components/icons";

export default async function SettingsPage() {
  const t = await getTranslations("settings");
  const nav = await getTranslations("nav");
  const session = await getSession();
  const canUsers =
    session?.perms.includes("*") ||
    session?.perms.includes("settings.users.manage");
  const canWarehouses =
    session?.perms.includes("*") ||
    session?.perms.includes("settings.warehouses.manage");

  return (
    <div className="space-y-4">
      <PageHeader title={nav("settings")} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {canUsers && (
          <Link href="/settings/users" className="group">
            <Card className="flex items-start gap-4 p-5 transition-all group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:shadow-md">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                {icons.clients("h-5 w-5")}
              </span>
              <span>
                <span className="block font-semibold">{t("users")}</span>
                <span className="mt-0.5 block text-sm text-muted">
                  {t("usersDesc")}
                </span>
              </span>
            </Card>
          </Link>
        )}
        {canWarehouses && (
          <Link href="/settings/warehouses" className="group">
            <Card className="flex items-start gap-4 p-5 transition-all group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:shadow-md">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                {icons.stock("h-5 w-5")}
              </span>
              <span>
                <span className="block font-semibold">{t("warehouses")}</span>
                <span className="mt-0.5 block text-sm text-muted">
                  {t("warehousesDesc")}
                </span>
              </span>
            </Card>
          </Link>
        )}
      </div>
    </div>
  );
}
