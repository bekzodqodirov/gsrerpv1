import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { getSession } from "@/modules/shared/auth";
import { listClientTariffs, getFinanceClients } from "@/modules/finance/service";
import { dateStr } from "@/modules/finance/fx";
import {
  PageHeader,
  CollapsibleCard,
  Badge,
  TableWrap,
  Th,
  Td,
  TRow,
  EmptyRow,
} from "@/components/ui";
import { TariffForm } from "./tariff-form";

export default async function TariffsPage() {
  const locale = await getLocale();
  const t = await getTranslations("finance");
  const session = await getSession();
  const canManage =
    !!session &&
    (session.perms.includes("*") || session.perms.includes("finance.manage"));

  const [rows, clients] = await Promise.all([
    listClientTariffs(),
    canManage ? getFinanceClients() : Promise.resolve([]),
  ]);
  const num = (n: number, d = 2) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: d }).format(n);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/finance" className="text-sm text-muted hover:text-foreground">
          ← {t("title")}
        </Link>
        <PageHeader title={t("tariffs")} />
      </div>

      {canManage && (
        <CollapsibleCard title={t("newTariff")}>
          <TariffForm clients={clients} today={dateStr()} />
        </CollapsibleCard>
      )}

      <TableWrap>
        <thead>
          <tr>
            <Th>{t("client")}</Th>
            <Th>{t("unit")}</Th>
            <Th className="text-right">{t("rate")}</Th>
            <Th>{t("validFrom")}</Th>
            <Th>{t("validTo")}</Th>
            <Th>{t("note")}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={6} text={t("noTariffs")} />
          ) : (
            rows.map((r) => {
              const active = r.validTo === null;
              return (
                <TRow key={r.id} className={active ? "" : "opacity-60"}>
                  <Td>
                    <span className="font-mono text-xs font-bold">{r.clientCode}</span>
                    <span className="ml-1.5 text-muted">{r.clientName}</span>
                  </Td>
                  <Td>{r.unit === "kg" ? t("perKg") : t("perM3")}</Td>
                  <Td className="text-right font-mono tabular-nums">
                    {num(Number(r.rate), 4)} {r.currency}
                  </Td>
                  <Td className="font-mono text-xs">{r.validFrom}</Td>
                  <Td>
                    {active ? (
                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                        {t("active")}
                      </Badge>
                    ) : (
                      <span className="font-mono text-xs text-muted">{r.validTo}</span>
                    )}
                  </Td>
                  <Td className="text-muted">{r.note ?? "—"}</Td>
                </TRow>
              );
            })
          )}
        </tbody>
      </TableWrap>
    </div>
  );
}
