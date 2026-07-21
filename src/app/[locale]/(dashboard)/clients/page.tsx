import { getTranslations } from "next-intl/server";
import { listClients } from "@/modules/clients/service";
import { ClientForm } from "./client-form";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const t = await getTranslations("clients");
  const tc = await getTranslations("common");
  const rows = await listClients(q);

  return (
    <main className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <form className="flex gap-2">
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

      <ClientForm />

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left dark:bg-gray-900">
            <tr>
              <th className="px-4 py-2 font-medium">{t("code")}</th>
              <th className="px-4 py-2 font-medium">{t("name")}</th>
              <th className="px-4 py-2 font-medium">{t("phone")}</th>
              <th className="px-4 py-2 font-medium">{t("city")}</th>
              <th className="px-4 py-2 font-medium">{t("creditLimit")}</th>
              <th className="px-4 py-2 font-medium">{t("status")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                  {t("empty")}
                </td>
              </tr>
            )}
            {rows.map((c) => (
              <tr
                key={c.id}
                className="border-t border-gray-100 dark:border-gray-800"
              >
                <td className="px-4 py-2 font-mono font-semibold">{c.code}</td>
                <td className="px-4 py-2">{c.name}</td>
                <td className="px-4 py-2">{c.phone}</td>
                <td className="px-4 py-2">{c.city}</td>
                <td className="px-4 py-2">
                  {c.creditLimitUsd != null ? `$${c.creditLimitUsd}` : "—"}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={
                      c.isActive
                        ? "rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800 dark:bg-green-900 dark:text-green-200"
                        : "rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                    }
                  >
                    {c.isActive ? t("active") : t("inactive")}
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
