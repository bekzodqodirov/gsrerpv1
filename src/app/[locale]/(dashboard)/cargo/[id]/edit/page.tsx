import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCargo, getReceiveFormData } from "@/modules/cargo/service";
import { getSession } from "@/modules/shared/auth";
import { PageHeader } from "@/components/ui";
import { CargoForm, type InitialCargoLine } from "../../cargo-form";

export default async function CargoEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("cargo");
  const session = await getSession();

  const canEdit =
    session?.perms.includes("*") || session?.perms.includes("cargo.receive");
  if (!canEdit) redirect(`/cargo/${id}`);

  const data = await getCargo(id);
  if (!data) notFound();
  if (data.cargo.status !== "received_cn") redirect(`/cargo/${id}`);

  const formData = await getReceiveFormData();
  // Mijoz keyinchalik nofaol qilingan bo'lsa ham tahrirlash formasida ko'rinsin
  const clientList = formData.clients.some((c) => c.id === data.cargo.clientId)
    ? formData.clients
    : [
        { id: data.cargo.clientId, code: data.clientCode, name: data.clientName },
        ...formData.clients,
      ];

  const initialLines: InitialCargoLine[] = data.lines.map((l) => ({
    productName: l.productName,
    boxCount: l.boxCount,
    boxLengthCm: l.boxLengthCm,
    boxWidthCm: l.boxWidthCm,
    boxHeightCm: l.boxHeightCm,
    weightPerBoxKg: l.weightPerBoxKg,
    totalWeightKg: l.totalWeightKg,
    totalVolumeM3: l.totalVolumeM3,
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${t("editCargo")} — ${data.cargo.regNumber}`}
      />
      <CargoForm
        cargoId={data.cargo.id}
        clients={clientList}
        warehouses={formData.warehouses}
        fixedWarehouseId={session?.warehouseId ?? null}
        initialClientId={data.cargo.clientId}
        initialWarehouseId={data.cargo.originWarehouseId}
        initialNote={data.cargo.note ?? ""}
        initialLines={initialLines}
      />
    </div>
  );
}
