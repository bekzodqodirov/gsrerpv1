import { getTranslations } from "next-intl/server";
import { listClients } from "@/modules/clients/service";
import {
  PageHeader,
  CollapsibleCard,
  TableWrap,
  Th,
  Td,
  TRow,
  EmptyRow,
  Badge,
  Input,
  Button,
} from "@/components/ui";
import { icons } from "@/components/icons";
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
    <div className="space-y-4">
      <PageHeader title={t("title")}>
        <form className="flex gap-2">
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted">
              {icons.search("h-4 w-4")}
            </span>
            <Input
              name="q"
              defaultValue={q ?? ""}
              placeholder={tc("search")}
              className="w-44 pl-9 sm:w-64"
            />
          </div>
          <Button type="submit" variant="outline">
            {tc("search")}
          </Button>
        </form>
      </PageHeader>

      <CollapsibleCard title={t("newClient")}>
        <ClientForm />
      </CollapsibleCard>

      <TableWrap>
        <thead className="bg-surface-2/60">
          <tr>
            <Th>{t("code")}</Th>
            <Th>{t("name")}</Th>
            <Th>{t("phone")}</Th>
            <Th>{t("city")}</Th>
            <Th>{t("creditLimit")}</Th>
            <Th>{t("status")}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <EmptyRow colSpan={6} text={t("empty")} />}
          {rows.map((c) => (
            <TRow key={c.id}>
              <Td className="font-mono font-semibold">{c.code}</Td>
              <Td className="font-medium">{c.name}</Td>
              <Td className="text-muted">{c.phone ?? "—"}</Td>
              <Td className="text-muted">{c.city ?? "—"}</Td>
              <Td className="font-mono tabular-nums">
                {c.creditLimitUsd != null ? `$${c.creditLimitUsd}` : "—"}
              </Td>
              <Td>
                <Badge
                  className={
                    c.isActive
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-surface-2 text-muted"
                  }
                >
                  {c.isActive ? t("active") : t("inactive")}
                </Badge>
              </Td>
            </TRow>
          ))}
        </tbody>
      </TableWrap>
    </div>
  );
}
