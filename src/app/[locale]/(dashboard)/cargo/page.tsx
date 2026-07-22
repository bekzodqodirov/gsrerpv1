import { getTranslations } from "next-intl/server";
import { getSession } from "@/modules/shared/auth";
import { listCargos, getReceiveFormData } from "@/modules/cargo/service";
import { PageHeader, CollapsibleCard } from "@/components/ui";
import { CargoForm } from "./cargo-form";
import { CargoShipmentsTable } from "./cargo-shipments-table";

export default async function CargoPage() {
  const t = await getTranslations("cargo");
  const session = await getSession();

  // Qidiruv/filtr endi jadvalning O'ZIDA (DataTable) — tepadagi qidiruv olib
  // tashlandi (ikkita qidiruv bo'lib chalkashtirmasin).
  const [rows, formData] = await Promise.all([
    listCargos(),
    getReceiveFormData(),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} />

      <CollapsibleCard title={t("newCargo")}>
        <CargoForm
          clients={formData.clients}
          warehouses={formData.warehouses}
          fixedWarehouseId={session?.warehouseId ?? null}
        />
      </CollapsibleCard>

      {/* Yagona ro'yxat: har prixod bosilganda tovarlarning to'liq
          ma'lumoti (o'lcham, og'irlik, QR kod) pastda ochiladi. */}
      <CargoShipmentsTable rows={rows} />
    </div>
  );
}
