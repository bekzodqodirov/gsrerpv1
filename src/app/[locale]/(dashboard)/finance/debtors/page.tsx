import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { getDebtors } from "@/modules/finance/billing";
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

function ageColor(days: number): string {
  if (days <= 15) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200";
  if (days <= 30) return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
  return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
}

export default async function DebtorsPage() {
  const locale = await getLocale();
  const t = await getTranslations("finance");
  const { rows, totalUsd } = await getDebtors();
  const num = (n: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(n);

  const b1 = rows.filter((r) => r.oldestDays <= 15).reduce((s, r) => s + r.balanceUsd, 0);
  const b2 = rows.filter((r) => r.oldestDays > 15 && r.oldestDays <= 30).reduce((s, r) => s + r.balanceUsd, 0);
  const b3 = rows.filter((r) => r.oldestDays > 30).reduce((s, r) => s + r.balanceUsd, 0);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/finance" className="text-sm text-muted hover:text-foreground">
          ← {t("title")}
        </Link>
        <PageHeader title={t("debtors")}>
          <ExportLink type="debtors" label={t("exportCsv")} />
        </PageHeader>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard value={`${num(totalUsd)} $`} label={t("debtorsTotal")} />
        <StatCard value={`${num(b1)} $`} label="0–15 kun" />
        <StatCard value={`${num(b2)} $`} label="15–30 kun" />
        <StatCard value={`${num(b3)} $`} label="30+ kun" />
      </div>

      <TableWrap>
        <thead>
          <tr>
            <Th>{t("client")}</Th>
            <Th className="text-right">{t("balance")}</Th>
            <Th className="text-right">{t("age")}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={3} text={t("noDebtors")} />
          ) : (
            rows.map((r) => (
              <TRow key={r.clientId}>
                <Td>
                  <span className="font-mono text-xs font-bold">{r.code}</span>
                  <span className="ml-1.5 text-muted">{r.name}</span>
                </Td>
                <Td className="text-right font-mono font-semibold tabular-nums">
                  {num(r.balanceUsd)} $
                </Td>
                <Td className="text-right">
                  <Badge className={ageColor(r.oldestDays)}>
                    {t("daysN", { n: r.oldestDays })}
                  </Badge>
                </Td>
              </TRow>
            ))
          )}
        </tbody>
      </TableWrap>
    </div>
  );
}
