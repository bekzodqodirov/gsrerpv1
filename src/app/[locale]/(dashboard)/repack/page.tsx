import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { getRepackFormData, listPallets } from "@/modules/repack/service";
import {
  PageHeader,
  TableWrap,
  Th,
  Td,
  TRow,
  EmptyRow,
  Badge,
} from "@/components/ui";
import { CreatePalletForm } from "./create-form";

const statusBadge: Record<string, string> = {
  open: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  closed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
};

export default async function RepackPage() {
  const t = await getTranslations("repack");
  const [form, rows] = await Promise.all([getRepackFormData(), listPallets()]);

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} />
      <p className="-mt-2 text-sm text-muted">{t("subtitle")}</p>

      <CreatePalletForm
        clients={form.clients}
        warehouses={form.warehouses}
        fixedWarehouseId={form.fixedWarehouseId}
      />

      <TableWrap>
        <thead className="bg-surface-2/60">
          <tr>
            <Th>{t("code")}</Th>
            <Th>{t("client")}</Th>
            <Th>{t("warehouse")}</Th>
            <Th className="text-right">{t("boxes")}</Th>
            <Th>{t("status")}</Th>
            <Th>{t("created")}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={6} text={t("empty")} />
          ) : (
            rows.map((p) => (
              <TRow key={p.id}>
                <Td className="font-mono text-sm font-semibold">
                  <Link
                    href={`/repack/${p.id}`}
                    className="text-primary hover:underline"
                  >
                    {p.code}
                  </Link>
                </Td>
                <Td>
                  <span className="font-mono text-xs font-bold">
                    {p.clientCode}
                  </span>
                  <span className="ml-1.5 hidden text-muted sm:inline">
                    {p.clientName}
                  </span>
                </Td>
                <Td className="text-muted">
                  <span className="font-mono">{p.warehouseGsCode}</span>
                </Td>
                <Td className="text-right font-mono tabular-nums">
                  {p.boxCount}
                </Td>
                <Td>
                  <Badge className={statusBadge[p.status] ?? ""}>
                    {t(`status_${p.status}` as "status_open")}
                  </Badge>
                </Td>
                <Td className="text-muted">
                  {p.createdAt.toISOString().slice(0, 10)}
                </Td>
              </TRow>
            ))
          )}
        </tbody>
      </TableWrap>
    </div>
  );
}
