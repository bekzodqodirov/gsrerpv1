import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getWarehouseStock } from "@/modules/stock/service";
import { PrintButton } from "../../cargo/[id]/labels/print-button";

// Chop etiladigan ombor hisoboti (manifest): mijozlar kesimi + yuklar ro'yxati.
export default async function WarehouseReportPage({
  searchParams,
}: {
  searchParams: Promise<{ wh?: string }>;
}) {
  const { wh } = await searchParams;
  const locale = await getLocale();
  const t = await getTranslations("stock");
  const ts = await getTranslations("cargoStatus");
  if (!wh) notFound();

  const detail = await getWarehouseStock(wh);
  if (!detail) notFound();
  const { warehouse: w, clients, cargos, totals } = detail;

  const num = (n: number, d = 0) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: d }).format(n);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-4xl text-black print:p-6">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <h1 className="text-xl font-bold">
          {t("reportTitle")} — {w.gsCode} {w.name}
        </h1>
        <PrintButton label={t("print")} />
      </div>

      {/* Chop bosh qismi */}
      <div className="border-b-2 border-black pb-3">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-2xl font-black">GSR CARGO</div>
            <div className="text-sm">{t("reportTitle")}</div>
          </div>
          <div className="text-right text-sm">
            <div className="text-lg font-bold">
              {w.gsCode} · {w.name}
            </div>
            <div className="text-gray-600">{today}</div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span>
            <b>{num(totals.totalVolumeM3, 2)}</b> {t("m3")}
          </span>
          <span>
            <b>{num(totals.totalWeightKg, 0)}</b> {t("kg")}
          </span>
          <span>
            <b>{num(totals.totalBoxes)}</b> {t("boxes")}
          </span>
          <span>
            <b>{num(totals.clientCount)}</b> {t("clients")}
          </span>
          <span>
            <b>{num(totals.cargoCount)}</b> {t("cargos")}
          </span>
        </div>
      </div>

      {/* Mijozlar kesimi */}
      <h2 className="mt-5 mb-1.5 text-sm font-bold uppercase">{t("byClient")}</h2>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-black text-left">
            <th className="py-1">{t("client")}</th>
            <th className="py-1 text-right">{t("volume")}</th>
            <th className="py-1 text-right">{t("weight")}</th>
            <th className="py-1 text-right">{t("boxes")}</th>
            <th className="py-1 text-right">{t("cargos")}</th>
            <th className="py-1 text-right">{t("age")}</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((c) => (
            <tr key={c.clientId} className="border-b border-gray-300">
              <td className="py-1">
                <b className="font-mono">{c.code}</b> {c.name}
              </td>
              <td className="py-1 text-right font-mono">{num(c.totalVolumeM3, 2)}</td>
              <td className="py-1 text-right font-mono">{num(c.totalWeightKg, 1)}</td>
              <td className="py-1 text-right font-mono">{num(c.totalBoxes)}</td>
              <td className="py-1 text-right font-mono">{num(c.cargoCount)}</td>
              <td className="py-1 text-right font-mono">
                {num(c.oldestDays)} {t("dayUnit")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Yuklar ro'yxati (FIFO) */}
      <h2 className="mt-5 mb-1.5 text-sm font-bold uppercase">{t("cargoList")}</h2>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-black text-left">
            <th className="py-1">{t("regNumber")}</th>
            <th className="py-1">{t("client")}</th>
            <th className="py-1">{t("status")}</th>
            <th className="py-1 text-right">{t("volume")}</th>
            <th className="py-1 text-right">{t("weight")}</th>
            <th className="py-1 text-right">{t("boxes")}</th>
            <th className="py-1 text-right">{t("age")}</th>
          </tr>
        </thead>
        <tbody>
          {cargos.map((c) => (
            <tr key={c.cargoId} className="border-b border-gray-300">
              <td className="py-1 font-mono font-semibold">{c.regNumber}</td>
              <td className="py-1 font-mono">{c.clientCode}</td>
              <td className="py-1">{ts(c.status as "received_cn")}</td>
              <td className="py-1 text-right font-mono">{num(c.volumeM3, 2)}</td>
              <td className="py-1 text-right font-mono">{num(c.weightKg, 1)}</td>
              <td className="py-1 text-right font-mono">{num(c.boxes)}</td>
              <td className="py-1 text-right font-mono">
                {num(c.days)} {t("dayUnit")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-8 flex justify-between border-t border-black pt-2 text-xs text-gray-600 print:mt-16">
        <span>{t("reportSignature")}: ________________</span>
        <span>{today}</span>
      </div>
    </div>
  );
}
