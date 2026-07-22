import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { getSession } from "@/modules/shared/auth";
import { listExpenses, getExpenseFormData } from "@/modules/finance/expenses";
import { dateStr } from "@/modules/finance/fx";
import {
  PageHeader,
  CollapsibleCard,
  StatCard,
  Badge,
  TableWrap,
  Th,
  Td,
  TRow,
  EmptyRow,
} from "@/components/ui";
import { ExportLink } from "@/components/export-link";
import { ExpenseForm } from "./expense-form";

const CATS = ["truck", "rent", "salary", "customs", "other"] as const;

export default async function ExpensesPage() {
  const locale = await getLocale();
  const t = await getTranslations("finance");
  const session = await getSession();
  const canManage =
    !!session &&
    (session.perms.includes("*") || session.perms.includes("finance.manage"));

  const [data, formData] = await Promise.all([
    listExpenses(),
    canManage ? getExpenseFormData() : Promise.resolve(null),
  ]);
  const num = (n: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(n);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/finance" className="text-sm text-muted hover:text-foreground">
          ← {t("title")}
        </Link>
        <PageHeader title={t("expenses")}>
          <ExportLink type="expenses" label={t("exportCsv")} />
        </PageHeader>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard value={`${num(data.totalUsd)} $`} label={t("expensesTotal")} />
        {CATS.map((c) => (
          <StatCard
            key={c}
            value={`${num(data.byCategory.get(c) ?? 0)} $`}
            label={t(`cat_${c}` as "cat_truck")}
          />
        ))}
      </div>

      {canManage && formData && (
        <CollapsibleCard title={t("newExpense")}>
          <ExpenseForm
            today={dateStr()}
            batches={formData.batches}
            warehouses={formData.warehouses}
            carriers={formData.carriers}
          />
        </CollapsibleCard>
      )}

      <TableWrap>
        <thead>
          <tr>
            <Th>{t("date")}</Th>
            <Th>{t("category")}</Th>
            <Th>{t("link")}</Th>
            <Th className="text-right">{t("amount")}</Th>
            <Th className="text-right">USD</Th>
            <Th>{t("note")}</Th>
          </tr>
        </thead>
        <tbody>
          {data.rows.length === 0 ? (
            <EmptyRow colSpan={6} text={t("noExpenses")} />
          ) : (
            data.rows.map((r) => (
              <TRow key={r.id}>
                <Td className="font-mono text-xs">{r.spentAt}</Td>
                <Td>
                  <Badge className="bg-surface-2 text-muted">
                    {t(`cat_${r.category}` as "cat_truck")}
                  </Badge>
                </Td>
                <Td className="font-mono text-xs text-muted">
                  {r.batchCode ?? r.warehouseCode ?? r.carrierName ?? "—"}
                </Td>
                <Td className="text-right font-mono tabular-nums">
                  {num(Number(r.amount))} {r.currency}
                </Td>
                <Td className="text-right font-mono tabular-nums">
                  {num(Number(r.amountUsd))}
                </Td>
                <Td className="text-muted">{r.note ?? "—"}</Td>
              </TRow>
            ))
          )}
        </tbody>
      </TableWrap>
    </div>
  );
}
