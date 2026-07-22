import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { getBatchProfitability } from "@/modules/finance/expenses";
import {
  PageHeader,
  StatCard,
  Badge,
  TableWrap,
  Th,
  Td,
  TRow,
  EmptyRow,
} from "@/components/ui";
import { ExportLink } from "@/components/export-link";

export default async function ProfitabilityPage() {
  const locale = await getLocale();
  const t = await getTranslations("finance");
  const { rows, totals } = await getBatchProfitability();
  const num = (n: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(n);

  const marginCls = (n: number) =>
    n > 0 ? "text-emerald-600" : n < 0 ? "text-red-600" : "text-muted";

  return (
    <div className="space-y-4">
      <div>
        <Link href="/finance" className="text-sm text-muted hover:text-foreground">
          ← {t("title")}
        </Link>
        <PageHeader title={t("profitability")}>
          <ExportLink type="profitability" label={t("exportCsv")} />
        </PageHeader>
      </div>
      <p className="-mt-2 text-sm text-muted">{t("profitabilityHint")}</p>

      <div className="grid grid-cols-3 gap-3">
        <StatCard value={`${num(totals.revenueUsd)} $`} label={t("revenue")} />
        <StatCard value={`${num(totals.costUsd)} $`} label={t("cost")} />
        <StatCard
          value={
            <span className={marginCls(totals.marginUsd)}>
              {num(totals.marginUsd)} $
            </span>
          }
          label={t("margin")}
        />
      </div>

      <TableWrap>
        <thead>
          <tr>
            <Th>{t("batch")}</Th>
            <Th>{t("route")}</Th>
            <Th className="text-right">{t("revenue")}</Th>
            <Th className="text-right">{t("cost")}</Th>
            <Th className="text-right">{t("margin")}</Th>
            <Th className="text-right">%</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={6} text={t("noProfitability")} />
          ) : (
            rows.map((r) => (
              <TRow key={r.batchId}>
                <Td className="font-mono text-xs font-semibold">
                  <Link href={`/tms/${r.batchId}`} className="text-primary hover:underline">
                    {r.code}
                  </Link>
                </Td>
                <Td className="whitespace-nowrap font-mono text-xs">
                  {r.originGs} <span className="text-muted">→</span> {r.destGs}
                </Td>
                <Td className="text-right font-mono tabular-nums">
                  {num(r.revenueUsd)}
                </Td>
                <Td className="text-right font-mono tabular-nums">
                  {num(r.costUsd)}
                </Td>
                <Td className={"text-right font-mono font-semibold tabular-nums " + marginCls(r.marginUsd)}>
                  {num(r.marginUsd)}
                </Td>
                <Td className="text-right">
                  {r.marginPct != null && (
                    <Badge
                      className={
                        r.marginUsd >= 0
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
                          : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                      }
                    >
                      {r.marginPct}%
                    </Badge>
                  )}
                </Td>
              </TRow>
            ))
          )}
        </tbody>
      </TableWrap>
    </div>
  );
}
