import { getTranslations } from "next-intl/server";
import { getSession } from "@/modules/shared/auth";
import { listUsers, getUserFormData } from "@/modules/users/service";
import {
  PageHeader,
  CollapsibleCard,
  TableWrap,
  Th,
  Td,
  TRow,
  Badge,
} from "@/components/ui";
import { UserForm } from "./user-form";
import { ToggleActive } from "./toggle-active";

export default async function UsersPage() {
  const t = await getTranslations("users");
  const session = await getSession();

  const [rows, formData] = await Promise.all([listUsers(), getUserFormData()]);

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} />

      <CollapsibleCard title={t("newUser")}>
        <UserForm
          roles={formData.roles.map((r) => ({ code: r.code, name: r.name }))}
          warehouses={formData.warehouses}
        />
      </CollapsibleCard>

      <TableWrap>
        <thead className="bg-surface-2/60">
          <tr>
            <Th>{t("username")}</Th>
            <Th>{t("fullName")}</Th>
            <Th>{t("role")}</Th>
            <Th>{t("warehouse")}</Th>
            <Th>{t("status")}</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <TRow key={u.id}>
              <Td className="font-mono font-semibold">{u.username}</Td>
              <Td className="font-medium">{u.fullName}</Td>
              <Td className="text-muted">{u.roles.join(", ") || "—"}</Td>
              <Td className="text-muted">{u.warehouseCode ?? "—"}</Td>
              <Td>
                <Badge
                  className={
                    u.isActive
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-surface-2 text-muted"
                  }
                >
                  {u.isActive ? t("active") : t("inactive")}
                </Badge>
              </Td>
              <Td className="text-right">
                <ToggleActive
                  id={u.id}
                  isActive={u.isActive}
                  disabled={u.id === session?.sub}
                />
              </Td>
            </TRow>
          ))}
        </tbody>
      </TableWrap>
    </div>
  );
}
