// QR yorliqlar: har karobkaga bittadan, chop etib yopishtiriladi.
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import QRCode from "qrcode";
import { getCargo, getCargoBoxes } from "@/modules/cargo/service";
import { PrintButton } from "./print-button";

export default async function CargoLabelsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("cargo");

  const data = await getCargo(id);
  if (!data) notFound();
  const boxes = await getCargoBoxes(id);

  // QR kodlarni server tomonda data-URL qilib tayyorlaymiz
  const labels = await Promise.all(
    boxes.map(async (b) => ({
      ...b,
      qrDataUrl: await QRCode.toDataURL(b.qrCode, {
        width: 160,
        margin: 1,
      }),
    })),
  );

  return (
    <div className="print:p-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <h1 className="text-xl font-bold sm:text-2xl">
          {t("qrLabels")} —{" "}
          <span className="font-mono">{data.cargo.regNumber}</span>{" "}
          <span className="font-normal text-muted">({boxes.length})</span>
        </h1>
        <PrintButton label={t("print")} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-3 print:gap-2">
        {labels.map((b) => (
          <div
            key={b.qrCode}
            className="flex break-inside-avoid flex-col items-center rounded-xl border border-line bg-white p-3 text-center print:rounded-none print:border-black"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.qrDataUrl} alt={b.qrCode} className="h-28 w-28" />
            <div className="mt-1 font-mono text-sm font-bold text-black">
              {b.qrCode}
            </div>
            <div className="text-xs text-gray-700">
              <span className="font-semibold">{data.warehouseCode}</span> ·{" "}
              <span className="font-semibold">{data.clientCode}</span> ·{" "}
              {b.productName}
            </div>
            <div className="text-[11px] text-gray-500">
              {data.cargo.receivedAt.toISOString().slice(0, 10)} ·{" "}
              {b.boxNo}/{boxes.length}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
