import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { getSession } from "@/modules/shared/auth";
import { listBatches, getBatchFormData } from "@/modules/tms/service";
import { batchStatusColors } from "@/components/batch-status";
import {
  PageHeader,
  CollapsibleCard,
  Button,
  Badge,
  TableWrap,
  Th,
  Td,
  TRow,
  EmptyRow,
} from "@/components/ui";
import { icons } from "@/components/icons";
import { BatchForm } from "./batch-form";

export default async function TmsPage() {
  const locale = await getLocale();
  const t = await getTranslations("tms");
  const ts = await getTranslations("batchStatus");
  const session = await getSession();
  const canManage =
    !!session &&
    (session.perms.includes("*") || session.perms.includes("tms.manage"));
  const canLoad =
    canManage || !!session?.perms.includes("tms.load");
  // Scan tugmasi: yuklash bosqichida FAQAT plan tuzilgan bo'lsa (aks holda
  // scan sahifasi baribir obzorga qaytaradi), tushirish bosqichida doim.
  const showScan = (b: { status: string; cargoCount: number }) =>
    b.status === "departed" || b.status === "arrived"
      ? true
      : (b.status === "planned" || b.status === "loading") && b.cargoCount > 0;

  const num = (n: number, d = 0) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: d }).format(n);

  const [rows, formData] = await Promise.all([
    listBatches(),
    canManage ? getBatchFormData() : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")}>
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

      <TableWrap>
        <thead>
          <tr>
            <Th>{t("code")}</Th>
            <Th>{t("route")}</Th>
            <Th>{t("status")}</Th>
            <Th className="text-right">{t("volume")}</Th>
            <Th className="text-right">{t("weight")}</Th>
            <Th className="text-right">{t("cargos")}</Th>
            {canManage && <Th className="text-right">{t("price")}</Th>}
            {canLoad && <Th />}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow
              colSpan={(canManage ? 7 : 6) + (canLoad ? 1 : 0)}
              text={t("noBatches")}
            />
          ) : (
            rows.map((b) => (
              <TRow key={b.id}>
                <Td className="font-mono text-sm font-semibold">
                  <Link
                    href={`/tms/${b.id}`}
                    className="text-primary hover:underline"
                  >
                    {b.code}
                  </Link>
                </Td>
                <Td className="whitespace-nowrap font-mono text-xs">
                  {b.originGs} <span className="text-muted">→</span> {b.destGs}
                </Td>
                <Td>
                  <Badge className={batchStatusColors[b.status] ?? ""}>
                    {ts(b.status as "planned")}
                  </Badge>
                </Td>
                <Td className="text-right font-mono tabular-nums">
                  {num(b.totalVolumeM3, 2)} m³
                </Td>
                <Td className="text-right font-mono tabular-nums">
                  {num(b.totalWeightKg)} kg
                </Td>
                <Td className="text-right font-mono tabular-nums">
                  {num(b.cargoCount)}
                </Td>
                {canManage && (
                  <Td className="text-right font-mono tabular-nums">
                    {b.agreedPrice
                      ? `${num(Number(b.agreedPrice), 2)} ${b.currency ?? ""}`
                      : "—"}
                  </Td>
                )}
                {canLoad && (
                  <Td>
                    {showScan(b) && (
                      <Link
                        href={`/tms/${b.id}/scan`}
                        className="inline-flex h-9 touch-manipulation items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-white hover:bg-primary-hover"
                      >
                        {icons.qr("h-4 w-4")}
                        {t("scanBtn")}
                      </Link>
                    )}
                  </Td>
                )}
              </TRow>
            ))
          )}
        </tbody>
      </TableWrap>
    </div>
  );
}
