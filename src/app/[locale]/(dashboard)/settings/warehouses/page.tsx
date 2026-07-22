import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { getSession } from "@/modules/shared/auth";
import { listWarehousesForSettings } from "@/modules/stock/service";
import { Link } from "@/i18n/routing";
import { PageHeader } from "@/components/ui";
import { CapacityEditor } from "./capacity-editor";

export default async function WarehouseSettingsPage() {
  const t = await getTranslations("stock");
  const nav = await getTranslations("nav");
  const session = await getSession();
  const canManage =
    session?.perms.includes("*") ||
    session?.perms.includes("settings.warehouses.manage");
  if (!canManage) notFound();

  const warehouses = await listWarehousesForSettings();

  return (
    <div className="space-y-4">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        ← {nav("settings")}
      </Link>
      <PageHeader title={t("capacityTitle")} />
      <p className="-mt-2 text-sm text-muted">{t("capacityDesc")}</p>
      <CapacityEditor
        warehouses={warehouses.map((w) => ({
          id: w.id,
          gsCode: w.gsCode,
          name: w.name,
          country: w.country,
          capacityM3: w.capacityM3,
          capacityKg: w.capacityKg,
        }))}
        labels={{
          warehouse: t("warehouse"),
          capacityM3: t("capacityM3"),
          capacityKg: t("capacityKg"),
          save: t("save"),
          saved: t("saved"),
        }}
      />
    </div>
  );
}
