import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { getSession } from "@/modules/shared/auth";
import { listInvoices } from "@/modules/finance/billing";
import { invoiceStatusColors } from "@/components/invoice-status";
import {
  PageHeader,
  Badge,
  Button,
  TableWrap,
  Th,
  Td,
  TRow,
  EmptyRow,
} from "@/components/ui";
import { icons } from "@/components/icons";

export default async function InvoicesPage() {
  const locale = await getLocale();
  const t = await getTranslations("finance");
  const ts = await getTranslations("invoiceStatus");
  const session = await getSession();
  const canManage =
    !!session &&
    (session.perms.includes("*") || session.perms.includes("finance.manage"));

  const rows = await listInvoices();
  const num = (n: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(n);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/finance" className="text-sm text-muted hover:text-foreground">
          ← {t("title")}
        </Link>
        <PageHeader title={t("invoices")}>
          {canManage && (
            <Link href="/finance/invoices/new">
              <Button>{icons.cargo("h-4 w-4")}{t("newInvoice")}</Button>
            </Link>
          )}
        </PageHeader>
      </div>

      <TableWrap>
        <thead>
          <tr>
            <Th>{t("number")}</Th>
            <Th>{t("client")}</Th>
            <Th>{t("status")}</Th>
            <Th className="text-right">{t("total")}</Th>
            <Th>{t("due")}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={5} text={t("noInvoices")} />
          ) : (
            rows.map((r) => (
              <TRow key={r.id}>
                <Td className="font-mono text-xs font-semibold">
                  <Link href={`/finance/invoices/${r.id}`} className="text-primary hover:underline">
                    {r.number}
                  </Link>
                </Td>
                <Td>
                  <span className="font-mono text-xs font-bold">{r.clientCode}</span>
                  <span className="ml-1.5 text-muted">{r.clientName}</span>
                </Td>
                <Td>
                  <Badge className={invoiceStatusColors[r.status] ?? ""}>
                    {ts(r.status as "draft")}
                  </Badge>
                </Td>
                <Td className="text-right font-mono tabular-nums">
                  {num(Number(r.total))} {r.currency}
                </Td>
                <Td className="font-mono text-xs text-muted">{r.dueAt ?? "—"}</Td>
              </TRow>
            ))
          )}
        </tbody>
      </TableWrap>
    </div>
  );
}
