import { getTranslations } from "next-intl/server";
import { getSession } from "@/modules/shared/auth";
import { listCargos, getReceiveFormData } from "@/modules/cargo/service";
import { cargoStatuses, type CargoStatus } from "@/modules/cargo/dto";
import {
  PageHeader,
  CollapsibleCard,
  Input,
  Select,
  Button,
} from "@/components/ui";
import { icons } from "@/components/icons";
import { CargoForm } from "./cargo-form";
import { CargoShipmentsTable } from "./cargo-shipments-table";

export default async function CargoPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status } = await searchParams;
  const t = await getTranslations("cargo");
  const ts = await getTranslations("cargoStatus");
  const tc = await getTranslations("common");
  const session = await getSession();

  const validStatus = cargoStatuses.includes(status as CargoStatus)
    ? (status as CargoStatus)
    : undefined;

  const [rows, formData] = await Promise.all([
    listCargos({ q, status: validStatus }),
    getReceiveFormData(),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")}>
        <form className="flex flex-wrap gap-2">
          <Select
            name="status"
            defaultValue={validStatus ?? ""}
            className="w-auto min-w-36"
          >
            <option value="">{t("allStatuses")}</option>
            {cargoStatuses.map((s) => (
              <option key={s} value={s}>
                {ts(s)}
              </option>
            ))}
          </Select>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted">
              {icons.search("h-4 w-4")}
            </span>
            <Input
              name="q"
              defaultValue={q ?? ""}
              placeholder={tc("search")}
              className="w-40 pl-9 sm:w-56"
            />
          </div>
          <Button type="submit" variant="outline">
            {tc("search")}
          </Button>
        </form>
      </PageHeader>

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
