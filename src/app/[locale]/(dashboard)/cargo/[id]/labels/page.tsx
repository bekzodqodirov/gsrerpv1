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
        width: 220,
        margin: 1,
      }),
    })),
  );

  // Yorliqda ko'rinadigan sklad — yuk QAYSI skladdan kelgani (qabul qilingan):
  const originGs = data.originGsCode ?? data.warehouseGsCode ?? "—";
  const originName = data.originName ?? data.warehouseName ?? "";
  const receivedDate = data.cargo.receivedAt.toISOString().slice(0, 10);

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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2 print:gap-2">
        {labels.map((b) => (
          <div
            key={`${b.lineId}-${b.boxNo}`}
            className="flex break-inside-avoid flex-col rounded-xl border-2 border-black bg-white p-3 text-black print:rounded-none"
          >
            {/* Yuqori satr: QAYSI SKLADDAN kelgani + sana */}
            <div className="flex items-center justify-between border-b-2 border-black pb-1.5">
              <span className="text-lg font-black tracking-tight">
                {originGs}
              </span>
              <span className="truncate pl-2 text-xs font-medium text-gray-600">
                {originName}
              </span>
            </div>

            {/* O'rta: KATTA CLIENTkod-HARF + QR (unikal karobka ID) */}
            <div className="flex items-stretch gap-3 py-2">
              <div className="flex min-w-0 flex-1 flex-col justify-center">
                <div className="text-4xl leading-none font-black tracking-tight tabular-nums">
                  {data.clientCode}-{b.letterCode}
                </div>
                <div className="mt-1.5 truncate text-sm font-semibold text-gray-800">
                  {b.productName}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.qrDataUrl} alt={b.qrCode} className="h-24 w-24" />
              </div>
            </div>

            {/* Pastki satr: UNIKAL karobka ID (track qilish uchun) + tartib */}
            <div className="flex items-center justify-between border-t-2 border-black pt-1.5">
              <span className="font-mono text-xs font-bold">{b.qrCode}</span>
              <span className="rounded bg-black px-2 py-0.5 text-xs font-black text-white tabular-nums">
                {b.position}/{b.boxCount}
              </span>
            </div>
            <div className="mt-0.5 text-right text-[10px] text-gray-500">
              {receivedDate}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
