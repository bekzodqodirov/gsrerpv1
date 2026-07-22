import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getPallet } from "@/modules/repack/service";
import { PackPanel } from "./pack-panel";

export default async function PalletDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("repack");
  const data = await getPallet(id);
  if (!data) notFound();

  const labels: Record<string, string> = {
    back: t("title"),
    client: t("client"),
    warehouse: t("warehouse"),
    boxes: t("boxes"),
    weight: t("weight"),
    volume: t("volume"),
    scanTitle: t("scanTitle"),
    scanPlaceholder: t("scanPlaceholder"),
    add: t("add"),
    camera: t("camera"),
    stopCamera: t("stopCamera"),
    close: t("closePallet"),
    reopen: t("reopenPallet"),
    delete: t("delete"),
    print: t("printLabel"),
    remove: t("remove"),
    qr: t("qr"),
    letter: t("letter"),
    product: t("product"),
    empty: t("emptyBoxes"),
    status_open: t("status_open"),
    status_closed: t("status_closed"),
    closedNote: t("closedNote"),
    confirmDelete: t("confirmDelete"),
    kg: t("kg"),
    m3: t("m3"),
    out_packed: t("out_packed"),
    out_moved: t("out_moved"),
    out_already_here: t("out_already_here"),
    out_wrong_client: t("out_wrong_client"),
    out_not_here: t("out_not_here"),
    out_pallet_closed: t("out_pallet_closed"),
    out_unknown: t("out_unknown"),
  };

  return (
    <PackPanel
      palletId={id}
      code={data.pallet.code}
      status={data.pallet.status}
      clientCode={data.clientCode}
      clientName={data.clientName}
      warehouseGsCode={data.warehouseGsCode}
      warehouseName={data.warehouseName}
      boxes={data.boxes}
      totals={data.totals}
      labels={labels}
    />
  );
}
