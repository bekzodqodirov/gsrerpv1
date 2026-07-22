import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { getSession } from "@/modules/shared/auth";
import { listExchangeRates, latestRates } from "@/modules/finance/service";
import { dateStr } from "@/modules/finance/fx";
import {
  PageHeader,
  CollapsibleCard,
  StatCard,
  TableWrap,
  Th,
  Td,
  TRow,
  EmptyRow,
} from "@/components/ui";
import { RateForm } from "./rate-form";

export default async function RatesPage() {
  const locale = await getLocale();
  const t = await getTranslations("finance");
  const session = await getSession();
  const canManage =
    !!session &&
    (session.perms.includes("*") || session.perms.includes("finance.manage"));

  const [rows, latest] = await Promise.all([listExchangeRates(), latestRates()]);
  const num = (n: number, d = 4) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: d }).format(n);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/finance" className="text-sm text-muted hover:text-foreground">
          ← {t("title")}
        </Link>
        <PageHeader title={t("rates")} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard value="1.0000" label="USD" />
        <StatCard
          value={latest.get("CNY") ? num(Number(latest.get("CNY")!.rate)) : "—"}
          label="CNY → USD"
        />
        <StatCard
          value={latest.get("UZS") ? num(Number(latest.get("UZS")!.rate), 8) : "—"}
          label="UZS → USD"
        />
      </div>

      {canManage && (
        <CollapsibleCard title={t("newRate")}>
          <RateForm today={dateStr()} />
        </CollapsibleCard>
      )}

      <TableWrap>
        <thead>
          <tr>
            <Th>{t("date")}</Th>
            <Th>{t("currency")}</Th>
            <Th className="text-right">{t("rateToUsd")}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={3} text={t("noRates")} />
          ) : (
            rows.map((r) => (
              <TRow key={r.id}>
                <Td className="font-mono text-xs">{r.rateDate}</Td>
                <Td className="font-medium">{r.currency}</Td>
                <Td className="text-right font-mono tabular-nums">
                  {num(Number(r.rateToUsd), 8)}
                </Td>
              </TRow>
            ))
          )}
        </tbody>
      </TableWrap>
    </div>
  );
}
