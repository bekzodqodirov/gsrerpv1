import { getTranslations } from "next-intl/server";
import { getSession } from "@/modules/shared/auth";
import { listUsers, getUserFormData } from "@/modules/users/service";
import { UserForm } from "./user-form";
import { ToggleActive } from "./toggle-active";

export default async function UsersPage() {
  const t = await getTranslations("users");
  const session = await getSession();

  const [rows, formData] = await Promise.all([listUsers(), getUserFormData()]);

  return (
    <main className="space-y-6 p-8">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      <UserForm
        roles={formData.roles.map((r) => ({ code: r.code, name: r.name }))}
        warehouses={formData.warehouses}
      />

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left dark:bg-gray-900">
            <tr>
              <th className="px-4 py-2 font-medium">{t("username")}</th>
              <th className="px-4 py-2 font-medium">{t("fullName")}</th>
              <th className="px-4 py-2 font-medium">{t("role")}</th>
              <th className="px-4 py-2 font-medium">{t("warehouse")}</th>
              <th className="px-4 py-2 font-medium">{t("status")}</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr
                key={u.id}
                className="border-t border-gray-100 dark:border-gray-800"
              >
                <td className="px-4 py-2 font-mono font-semibold">
                  {u.username}
                </td>
                <td className="px-4 py-2">{u.fullName}</td>
                <td className="px-4 py-2">{u.roles.join(", ") || "—"}</td>
                <td className="px-4 py-2">{u.warehouseCode ?? "—"}</td>
                <td className="px-4 py-2">
                  <span
                    className={
                      u.isActive
                        ? "rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800 dark:bg-green-900 dark:text-green-200"
                        : "rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                    }
                  >
                    {u.isActive ? t("active") : t("inactive")}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <ToggleActive
                    id={u.id}
                    isActive={u.isActive}
                    disabled={u.id === session?.sub}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
