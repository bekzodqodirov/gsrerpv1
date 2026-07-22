import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { getMonthlyPnl } from "@/modules/finance/expenses";
import {
  PageHeader,
  StatCard,
  TableWrap,
  Th,
  Td,
  TRow,
  EmptyRow,
} from "@/components/ui";
import { ExportLink } from "@/components/export-link";

export default async function PnlPage() {
  const locale = await getLocale();
  const t = await getTranslations("finance");
  const { rows, totals } = await getMonthlyPnl();
  const num = (n: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(n);
  const mcls = (n: number) => (n > 0 ? "text-emerald-600" : n < 0 ? "text-red-600" : "text-muted");

  return (
    <div className="space-y-4">
      <div>
        <Link href="/finance" className="text-sm text-muted hover:text-foreground">
          ← {t("title")}
        </Link>
        <PageHeader title={t("pnl")}>
          <ExportLink type="pnl" label={t("exportCsv")} />
        </PageHeader>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard value={`${num(totals.revenueUsd)} $`} label={t("revenue")} />
        <StatCard value={`${num(totals.expenseUsd)} $`} label={t("cost")} />
        <StatCard
          value={<span className={mcls(totals.marginUsd)}>{num(totals.marginUsd)} $</span>}
          label={t("margin")}
        />
      </div>

      <TableWrap>
        <thead>
          <tr>
            <Th>{t("month")}</Th>
            <Th className="text-right">{t("revenue")}</Th>
            <Th className="text-right">{t("cost")}</Th>
            <Th className="text-right">{t("margin")}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={4} text={t("noData")} />
          ) : (
            rows.map((r) => (
              <TRow key={r.month}>
                <Td className="font-mono">{r.month}</Td>
                <Td className="text-right font-mono tabular-nums">{num(r.revenueUsd)}</Td>
                <Td className="text-right font-mono tabular-nums">{num(r.expenseUsd)}</Td>
                <Td className={"text-right font-mono font-semibold tabular-nums " + mcls(r.marginUsd)}>
                  {num(r.marginUsd)}
                </Td>
              </TRow>
            ))
          )}
        </tbody>
      </TableWrap>
    </div>
  );
}
