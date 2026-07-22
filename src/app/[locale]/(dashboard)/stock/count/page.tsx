import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getWarehouseBoxes } from "@/modules/stock/service";
import { Link } from "@/i18n/routing";
import { StocktakeClient } from "./stocktake-client";

// Inventarizatsiya (stocktake): omborda kutilgan karobkalarni QR/scanner bilan
// sanab chiqish — topilgan / yo'q / begona karobkalarni aniqlash.
export default async function StocktakePage({
  searchParams,
}: {
  searchParams: Promise<{ wh?: string }>;
}) {
  const { wh } = await searchParams;
  const t = await getTranslations("stock");
  if (!wh) notFound();

  const data = await getWarehouseBoxes(wh);
  if (!data) notFound();

  const labels = {
    title: t("stocktake"),
    warehouse: data.warehouse.gsCode + " · " + data.warehouse.name,
    back: t("backToOverview"),
    expected: t("expected"),
    scanned: t("scanned"),
    found: t("foundLabel"),
    missing: t("missingLabel"),
    extra: t("extraLabel"),
    camera: t("camera"),
    stopCamera: t("stopCamera"),
    manualPlaceholder: t("scanPlaceholder"),
    add: t("add"),
    reset: t("reset"),
    exportCsv: t("exportDiscrepancy"),
    missingList: t("missingList"),
    extraList: t("extraList"),
    allScanned: t("allScanned"),
    qr: t("qr"),
    client: t("client"),
    product: t("product"),
    letter: t("letter"),
    dayUnit: t("dayUnit"),
    outcomeFound: t("outcomeFound"),
    outcomeDuplicate: t("outcomeDuplicate"),
    outcomeExtra: t("outcomeExtra"),
    progress: t("progressLabel"),
  };

  return (
    <div className="space-y-4">
      <Link
        href={`/stock?wh=${wh}`}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        ← {labels.back}
      </Link>
      <StocktakeClient
        boxes={data.boxes}
        warehouseLabel={labels.warehouse}
        labels={labels}
      />
    </div>
  );
}
