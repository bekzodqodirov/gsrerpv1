import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { getSession } from "@/modules/shared/auth";
import { listBatches, getBatchFormData } from "@/modules/tms/service";
import { PageHeader, CollapsibleCard, Button } from "@/components/ui";
import { icons } from "@/components/icons";
import { BatchForm } from "./batch-form";
import { BatchesTable } from "./batches-table";

export default async function TmsPage() {
  const t = await getTranslations("tms");
  const session = await getSession();
  const canManage =
    !!session &&
    (session.perms.includes("*") || session.perms.includes("tms.manage"));
  const canLoad = canManage || !!session?.perms.includes("tms.load");

  const [rows, formData] = await Promise.all([
    listBatches(),
    canManage ? getBatchFormData() : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")}>
        <Link href="/tms/archive">
          <Button variant="outline">{t("archiveTitle")}</Button>
        </Link>
        <Link href="/tms/consolidation">
          <Button variant="outline">
            {icons.stock("h-4 w-4")}
            {t("consolidation")}
          </Button>
        </Link>
        <Link href="/tms/carriers">
          <Button variant="outline">
            {icons.truck("h-4 w-4")}
            {t("carriers")}
          </Button>
        </Link>
      </PageHeader>

      {canManage && formData && (
        <CollapsibleCard title={t("newBatch")}>
          <BatchForm
            warehouses={formData.warehouses}
            carriers={formData.carriers}
          />
        </CollapsibleCard>
      )}

      <BatchesTable rows={rows} canManage={canManage} canLoad={canLoad} />
    </div>
  );
}
