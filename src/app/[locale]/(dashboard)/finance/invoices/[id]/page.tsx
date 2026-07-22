import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { getInvoice } from "@/modules/finance/billing";
import { getSession } from "@/modules/shared/auth";
import { invoiceStatusColors } from "@/components/invoice-status";
import {
  Card,
  Badge,
  Button,
  TableWrap,
  Th,
  Td,
  TRow,
} from "@/components/ui";
import { issueInvoiceAction, voidInvoiceAction } from "../../actions";
import { PaymentForm } from "./payment-form";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getInvoice(id);
  if (!data) notFound();

  const locale = await getLocale();
  const t = await getTranslations("finance");
  const ts = await getTranslations("invoiceStatus");
  const session = await getSession();
  const canManage =
    !!session &&
    (session.perms.includes("*") || session.perms.includes("finance.manage"));

  const inv = data.invoice;
  const num = (n: number, d = 2) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: d }).format(n);

  const paidUsd = data.payments.reduce((s, p) => s + Number(p.amountUsd), 0);
  const canIssue = canManage && inv.status === "draft";
  const canPay = canManage && (inv.status === "issued" || inv.status === "partially_paid");
  const canVoid = canManage && inv.status !== "void" && inv.status !== "paid";

  return (
    <div className="space-y-4">
      <div>
        <Link href="/finance/invoices" className="text-sm text-muted hover:text-foreground">
          ← {t("invoices")}
        </Link>
      </div>

      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-mono text-xl font-bold">{inv.number}</h1>
              <Badge className={invoiceStatusColors[inv.status] ?? ""}>
                {ts(inv.status as "draft")}
              </Badge>
            </div>
            <div className="mt-1 text-sm text-muted">
              <span className="font-mono font-bold text-foreground">{data.clientCode}</span>{" "}
              {data.clientName}
              {inv.dueAt && ` · ${t("due")}: ${inv.dueAt}`}
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-2xl font-bold tabular-nums">
              {num(Number(inv.total))} {inv.currency}
            </div>
            {inv.status !== "draft" && (
              <div className="text-xs text-muted">
                {t("paidUsd")}: {num(paidUsd)} USD
              </div>
            )}
          </div>
        </div>

        {canManage && (inv.status === "draft" || canVoid) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {canIssue && (
              <form action={issueInvoiceAction.bind(null, id)}>
                <Button type="submit">{t("issue")}</Button>
              </form>
            )}
            {canVoid && (
              <form action={voidInvoiceAction.bind(null, id)}>
                <Button type="submit" variant="outline">{t("void")}</Button>
              </form>
            )}
          </div>
        )}
      </Card>

      {/* Qatorlar */}
      <TableWrap>
        <thead>
          <tr>
            <Th>{t("description")}</Th>
            <Th className="text-right">{t("qty")}</Th>
            <Th className="text-right">{t("rate")}</Th>
            <Th className="text-right">{t("amount")}</Th>
          </tr>
        </thead>
        <tbody>
          {data.lines.map((l) => (
            <TRow key={l.id}>
              <Td>{l.description}</Td>
              <Td className="text-right font-mono tabular-nums">
                {num(Number(l.qty))} {l.unit === "kg" ? "kg" : "m³"}
              </Td>
              <Td className="text-right font-mono tabular-nums">
                {num(Number(l.rate), 4)}
              </Td>
              <Td className="text-right font-mono tabular-nums">
                {num(Number(l.amount))}
              </Td>
            </TRow>
          ))}
        </tbody>
      </TableWrap>

      {/* To'lovlar */}
      {inv.status !== "draft" && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-muted">{t("payments")}</h2>
          {data.payments.length === 0 ? (
            <p className="text-sm text-muted">{t("noPayments")}</p>
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>{t("date")}</Th>
                  <Th>{t("method")}</Th>
                  <Th className="text-right">{t("amount")}</Th>
                  <Th className="text-right">USD</Th>
                </tr>
              </thead>
              <tbody>
                {data.payments.map((p) => (
                  <TRow key={p.id}>
                    <Td className="font-mono text-xs">
                      {p.receivedAt.toISOString().slice(0, 10)}
                    </Td>
                    <Td>{t(p.method as "cash")}</Td>
                    <Td className="text-right font-mono tabular-nums">
                      {num(Number(p.amount))} {p.currency}
                    </Td>
                    <Td className="text-right font-mono tabular-nums">
                      {num(Number(p.amountUsd))}
                    </Td>
                  </TRow>
                ))}
              </tbody>
            </TableWrap>
          )}

          {canPay && (
            <Card className="mt-3 p-4">
              <div className="mb-2 text-sm font-semibold">{t("recordPayment")}</div>
              <PaymentForm
                clientId={inv.clientId}
                invoiceId={inv.id}
                defaultCurrency={inv.currency}
              />
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
