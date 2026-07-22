import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import QRCode from "qrcode";
import { getPallet } from "@/modules/repack/service";
import { PrintButton } from "../../../cargo/[id]/labels/print-button";

// Tahta yashik yorlig'i: KATTA yashik QR'i (yuklashda scan qilinadi) + tarkib.
export default async function PalletLabelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("repack");
  const data = await getPallet(id);
  if (!data) notFound();

  const qrDataUrl = await QRCode.toDataURL(data.pallet.code, {
    width: 320,
    margin: 1,
  });
  // Tarkib: harf bo'yicha nechta karobka.
  const byLetter = new Map<string, number>();
  for (const b of data.boxes)
    byLetter.set(b.letterCode, (byLetter.get(b.letterCode) ?? 0) + 1);

  return (
    <div className="print:p-0">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <h1 className="text-xl font-bold">
          {t("labelTitle")} — <span className="font-mono">{data.pallet.code}</span>
        </h1>
        <PrintButton label={t("print")} />
      </div>

      <div className="mx-auto max-w-md break-inside-avoid rounded-xl border-2 border-black bg-white p-5 text-black">
        <div className="flex items-center justify-between border-b-2 border-black pb-2">
          <span className="text-2xl font-black">
            {data.warehouseGsCode}
          </span>
          <span className="text-sm font-medium text-gray-600">
            {data.warehouseName}
          </span>
        </div>

        <div className="flex items-center gap-4 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt={data.pallet.code} className="h-40 w-40" />
          <div className="min-w-0">
            <div className="text-3xl leading-none font-black">
              {data.clientCode}
            </div>
            <div className="mt-1 truncate text-sm text-gray-700">
              {data.clientName}
            </div>
            <div className="mt-3 font-mono text-lg font-bold">
              {data.pallet.code}
            </div>
            <div className="text-sm font-semibold text-gray-800">
              {t("boxes")}: {data.totals.count} · {data.totals.weightKg} {t("kg")}{" "}
              · {data.totals.volumeM3} {t("m3")}
            </div>
          </div>
        </div>

        <div className="border-t-2 border-black pt-2">
          <div className="mb-1 text-xs font-bold uppercase">{t("contents")}</div>
          <div className="flex flex-wrap gap-1.5">
            {[...byLetter.entries()].map(([letter, n]) => (
              <span
                key={letter}
                className="rounded border border-black px-2 py-0.5 font-mono text-sm font-bold"
              >
                {data.clientCode}-{letter} × {n}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
