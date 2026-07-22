import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { getSession } from "@/modules/shared/auth";
import { listBatches } from "@/modules/tms/service";
import { batchStatusColors } from "@/components/batch-status";
import {
  PageHeader,
  Badge,
  TableWrap,
  Th,
  Td,
  TRow,
  EmptyRow,
} from "@/components/ui";

// Arxiv: jo'natilgan/qabul qilingan (yakunlangan) partiyalar — nima
// jo'natilgani/qabul qilingani keyin ko'rish uchun (items 15,16).
export default async function TmsArchivePage() {
  const locale = await getLocale();
  const t = await getTranslations("tms");
  const ts = await getTranslations("batchStatus");
  const session = await getSession();
  const canManage =
    !!session &&
    (session.perms.includes("*") || session.perms.includes("tms.manage"));

  const num = (n: number, d = 0) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: d }).format(n);

  const rows = await listBatches({ archived: true });

  return (
    <div className="space-y-4">
      <PageHeader title={t("archiveTitle")}>
        <Link
          href="/tms"
          className="text-sm text-muted hover:text-foreground"
        >
          ← {t("title")}
        </Link>
      </PageHeader>

      <TableWrap>
        <thead>
          <tr>
            <Th>{t("code")}</Th>
            <Th>{t("route")}</Th>
            <Th>{t("status")}</Th>
            <Th className="hidden text-right sm:table-cell">{t("volume")}</Th>
            <Th className="hidden text-right sm:table-cell">{t("weight")}</Th>
            <Th className="text-right">{t("cargos")}</Th>
            {canManage && (
              <Th className="hidden text-right sm:table-cell">{t("price")}</Th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={canManage ? 7 : 6} text={t("noBatches")} />
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
                <Td className="hidden text-right font-mono tabular-nums sm:table-cell">
                  {num(b.totalVolumeM3, 2)} m³
                </Td>
                <Td className="hidden text-right font-mono tabular-nums sm:table-cell">
                  {num(b.totalWeightKg)} kg
                </Td>
                <Td className="text-right font-mono tabular-nums">
                  {num(b.cargoCount)}
                </Td>
                {canManage && (
                  <Td className="hidden text-right font-mono tabular-nums sm:table-cell">
                    {b.agreedPrice
                      ? `${num(Number(b.agreedPrice), 2)} ${b.currency ?? ""}`
                      : "—"}
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
