import { getTranslations } from "next-intl/server";
import { getSession } from "@/modules/shared/auth";
import { listCargos, getReceiveFormData } from "@/modules/cargo/service";
import { cargoStatuses, type CargoStatus } from "@/modules/cargo/dto";
import { CargoForm } from "./cargo-form";

const statusColors: Record<string, string> = {
  received_cn: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  in_transit_ksg:
    "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  at_kashgar: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  loaded: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  cn_customs:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  in_transit_uz:
    "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  at_uz_warehouse:
    "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  uz_customs:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  ready: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  delivered: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  held: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  lost: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

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
    <main className="space-y-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <form className="flex flex-wrap gap-2">
          <select
            name="status"
            defaultValue={validStatus ?? ""}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-900"
          >
            <option value="">{t("allStatuses")}</option>
            {cargoStatuses.map((s) => (
              <option key={s} value={s}>
                {ts(s)}
              </option>
            ))}
          </select>
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder={tc("search")}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-900"
          />
          <button
            type="submit"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
          >
            {tc("search")}
          </button>
        </form>
      </div>

      <CargoForm
        clients={formData.clients}
        warehouses={formData.warehouses}
        fixedWarehouseId={session?.warehouseId ?? null}
      />

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left dark:bg-gray-900">
            <tr>
              <th className="px-4 py-2 font-medium">{t("regNumber")}</th>
              <th className="px-4 py-2 font-medium">{t("client")}</th>
              <th className="px-4 py-2 font-medium">{t("warehouse")}</th>
              <th className="px-4 py-2 font-medium">{t("pieces")}</th>
              <th className="px-4 py-2 font-medium">{t("weightKg")}</th>
              <th className="px-4 py-2 font-medium">{t("volumeM3")}</th>
              <th className="px-4 py-2 font-medium">{t("status")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                  {t("empty")}
                </td>
              </tr>
            )}
            {rows.map((c) => (
              <tr
                key={c.id}
                className="border-t border-gray-100 dark:border-gray-800"
              >
                <td className="px-4 py-2 font-mono font-semibold">
                  {c.regNumber}
                </td>
                <td className="px-4 py-2">
                  <span className="font-mono font-semibold">{c.clientCode}</span>{" "}
                  <span className="text-gray-500">{c.clientName}</span>
                </td>
                <td className="px-4 py-2">{c.warehouseCode ?? "—"}</td>
                <td className="px-4 py-2">{c.pieces}</td>
                <td className="px-4 py-2">{c.weightKg}</td>
                <td className="px-4 py-2">{c.volumeM3}</td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${statusColors[c.status] ?? ""}`}
                  >
                    {ts(c.status)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
