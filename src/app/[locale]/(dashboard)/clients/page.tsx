import { getTranslations } from "next-intl/server";
import { listClients } from "@/modules/clients/service";
import { PageHeader, CollapsibleCard } from "@/components/ui";
import { ClientForm } from "./client-form";
import { ClientsTable } from "./clients-table";

export default async function ClientsPage() {
  const t = await getTranslations("clients");
  // Qidiruv/filtr endi jadvalning O'ZIDA (DataTable) — ustun filtri, ustunlarni
  // yashirish va kenglikni o'zgartirish bilan.
  const rows = await listClients();

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} />

      <CollapsibleCard title={t("newClient")}>
        <ClientForm />
      </CollapsibleCard>

      <ClientsTable rows={rows} />
    </div>
  );
}
