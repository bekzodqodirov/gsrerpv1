import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { getFinanceClients } from "@/modules/finance/service";
import { getInvoiceableCargos } from "@/modules/finance/billing";
import { requirePermission } from "@/modules/shared/auth";
import { PageHeader, Card } from "@/components/ui";
import { ClientPicker } from "./client-picker";
import { DraftInvoiceForm } from "./draft-invoice-form";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  await requirePermission("finance.manage");
  const { client } = await searchParams;
  const t = await getTranslations("finance");
  const clients = await getFinanceClients();
  const rows = client ? await getInvoiceableCargos(client) : [];
  const selected = clients.find((c) => c.id === client);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/finance/invoices" className="text-sm text-muted hover:text-foreground">
          ← {t("invoices")}
        </Link>
        <PageHeader title={t("newInvoice")} />
      </div>

      <Card className="p-4">
        <div className="mb-2 text-sm font-medium">{t("selectClient")}</div>
        <ClientPicker clients={clients} current={client} />
      </Card>

      {selected && (
        <Card className="p-4">
          <div className="mb-3 text-sm font-semibold">
            {selected.code} — {selected.name} · {t("invoiceable")}
          </div>
          <DraftInvoiceForm clientId={selected.id} rows={rows} />
        </Card>
      )}
    </div>
  );
}
