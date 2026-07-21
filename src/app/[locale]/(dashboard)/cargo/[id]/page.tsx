import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCargo } from "@/modules/cargo/service";
import { listAttachments } from "@/modules/shared/attachments";
import { statusColors } from "@/components/cargo-status";
import { Link } from "@/i18n/routing";

export default async function CargoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("cargo");
  const ts = await getTranslations("cargoStatus");

  const data = await getCargo(id);
  if (!data) notFound();
  const { cargo, clientCode, clientName, warehouseCode, lines } = data;

  const [cargoFiles, ...lineFiles] = await Promise.all([
    listAttachments("cargo", cargo.id),
    ...lines.map((l) => listAttachments("cargo_line", l.id)),
  ]);

  return (
    <main className="space-y-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-mono text-2xl font-bold">{cargo.regNumber}</h1>
          <p className="mt-1 text-sm text-gray-500">
            <span className="font-mono font-semibold">{clientCode}</span>{" "}
            {clientName} · {warehouseCode ?? "—"} ·{" "}
            {cargo.receivedAt.toISOString().slice(0, 10)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-sm ${statusColors[cargo.status] ?? ""}`}
          >
            {ts(cargo.status)}
          </span>
          <Link
            href={`/cargo/${cargo.id}/labels`}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {t("qrLabels")}
          </Link>
        </div>
      </div>

      {/* Jami */}
      <div className="grid grid-cols-3 gap-3 sm:max-w-md">
        <div className="rounded-lg border border-gray-200 p-3 text-center dark:border-gray-700">
          <div className="text-xl font-bold">{cargo.totalBoxes}</div>
          <div className="text-xs text-gray-500">{t("boxCount")}</div>
        </div>
        <div className="rounded-lg border border-gray-200 p-3 text-center dark:border-gray-700">
          <div className="text-xl font-bold">{cargo.totalWeightKg}</div>
          <div className="text-xs text-gray-500">{t("totalWeight")}</div>
        </div>
        <div className="rounded-lg border border-gray-200 p-3 text-center dark:border-gray-700">
          <div className="text-xl font-bold">{cargo.totalVolumeM3}</div>
          <div className="text-xs text-gray-500">{t("totalVolume")}</div>
        </div>
      </div>

      {/* Qatorlar */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left dark:bg-gray-900">
            <tr>
              <th className="px-4 py-2 font-medium">#</th>
              <th className="px-4 py-2 font-medium">{t("product")}</th>
              <th className="px-4 py-2 font-medium">{t("boxCount")}</th>
              <th className="px-4 py-2 font-medium">{t("boxDims")}</th>
              <th className="px-4 py-2 font-medium">{t("weightPerBox")}</th>
              <th className="px-4 py-2 font-medium">{t("totalWeight")}</th>
              <th className="px-4 py-2 font-medium">{t("totalVolume")}</th>
              <th className="px-4 py-2 font-medium">{t("linePhotos")}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr
                key={l.id}
                className="border-t border-gray-100 dark:border-gray-800"
              >
                <td className="px-4 py-2">{l.lineNo}</td>
                <td className="px-4 py-2 font-medium">{l.productName}</td>
                <td className="px-4 py-2">{l.boxCount}</td>
                <td className="px-4 py-2">
                  {l.boxLengthCm
                    ? `${l.boxLengthCm}×${l.boxWidthCm}×${l.boxHeightCm}`
                    : "—"}
                </td>
                <td className="px-4 py-2">{l.weightPerBoxKg ?? "—"}</td>
                <td className="px-4 py-2">{l.totalWeightKg}</td>
                <td className="px-4 py-2">{l.totalVolumeM3}</td>
                <td className="px-4 py-2">
                  <div className="flex flex-wrap gap-1">
                    {lineFiles[i]?.map((f) => (
                      <a
                        key={f.id}
                        href={`/api/files/${f.id}`}
                        target="_blank"
                        className="block h-10 w-10 overflow-hidden rounded border border-gray-200 dark:border-gray-700"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/files/${f.id}`}
                          alt={f.fileName}
                          className="h-full w-full object-cover"
                        />
                      </a>
                    ))}
                    {(!lineFiles[i] || lineFiles[i].length === 0) && "—"}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Prixod fayllari */}
      <div>
        <h2 className="font-semibold">{t("receiptFiles")}</h2>
        {cargoFiles.length === 0 ? (
          <p className="mt-1 text-sm text-gray-500">—</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {cargoFiles.map((f) => (
              <li key={f.id}>
                <a
                  href={`/api/files/${f.id}`}
                  target="_blank"
                  className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                >
                  {f.fileName}
                </a>{" "}
                <span className="text-xs text-gray-400">
                  ({Math.round(f.sizeBytes / 1024)} KB)
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {cargo.note && (
        <p className="text-sm text-gray-500">
          <span className="font-medium">{t("note")}:</span> {cargo.note}
        </p>
      )}
    </main>
  );
}
