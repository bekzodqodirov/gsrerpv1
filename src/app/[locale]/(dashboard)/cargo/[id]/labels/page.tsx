// QR yorliqlar: har karobkaga bittadan, chop etib yopishtiriladi.
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import QRCode from "qrcode";
import { getCargo, getCargoBoxes } from "@/modules/cargo/service";
import { LabelSheet } from "./label-sheet";

export default async function CargoLabelsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ line?: string }>;
}) {
  const { id } = await params;
  const { line } = await searchParams;
  const t = await getTranslations("cargo");

  const data = await getCargo(id);
  if (!data) notFound();
  const allBoxes = await getCargoBoxes(id);
  // Bitta tovar (qator) tanlangan bo'lsa — faqat o'sha qator karobkalari.
  const boxes = line ? allBoxes.filter((b) => b.lineId === line) : allBoxes;

  // QR kodlarni server tomonda data-URL qilib tayyorlaymiz
  const labels = await Promise.all(
    boxes.map(async (b) => ({
      ...b,
      qrDataUrl: await QRCode.toDataURL(b.qrCode, {
        width: 220,
        margin: 1,
      }),
    })),
  );

  // Yorliqda ko'rinadigan sklad — yuk QAYSI skladdan kelgani (qabul qilingan):
  const originGs = data.originGsCode ?? data.warehouseGsCode ?? "—";
  const originName = data.originName ?? data.warehouseName ?? "";
  const receivedDate = data.cargo.receivedAt.toISOString().slice(0, 10);

  const sheetLabels = labels.map((b) => ({
    key: `${b.lineId}-${b.boxNo}`,
    clientCode: data.clientCode,
    letterCode: b.letterCode,
    productName: b.productName,
    qrCode: b.qrCode,
    position: b.position,
    boxCount: b.boxCount,
    qrDataUrl: b.qrDataUrl,
  }));

  return (
    <LabelSheet
      labels={sheetLabels}
      header={{ originGs, originName, receivedDate }}
      title={t("qrLabels")}
      regNumber={data.cargo.regNumber}
      lineCode={line && boxes[0] ? `${data.clientCode}-${boxes[0].letterCode}` : null}
      labels_i18n={{
        print: t("print"),
        labelSize: t("labelSize"),
      }}
    />
  );
}
