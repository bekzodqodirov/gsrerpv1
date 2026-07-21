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
    <main className="p-8 print:p-0">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold">
          {t("qrLabels")} — <span className="font-mono">{data.cargo.regNumber}</span>{" "}
          <span className="text-gray-500">({boxes.length})</span>
        </h1>
        <PrintButton label={t("print")} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-3 print:gap-2">
        {labels.map((b) => (
          <div
            key={b.qrCode}
            className="flex flex-col items-center rounded border border-gray-300 p-3 text-center break-inside-avoid dark:border-gray-600 print:border-black"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.qrDataUrl} alt={b.qrCode} className="h-28 w-28" />
            <div className="mt-1 font-mono text-sm font-bold">{b.qrCode}</div>
            <div className="text-xs text-gray-600 dark:text-gray-300 print:text-black">
              <span className="font-semibold">{data.clientCode}</span> ·{" "}
              {b.productName}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
