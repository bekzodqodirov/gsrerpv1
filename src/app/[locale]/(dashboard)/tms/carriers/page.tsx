import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { listCarriers } from "@/modules/tms/service";
import { getSession } from "@/modules/shared/auth";
import {
  PageHeader,
  CollapsibleCard,
  Badge,
  Button,
  TableWrap,
  Th,
  Td,
  TRow,
  EmptyRow,
} from "@/components/ui";
import { CarrierForm } from "./carrier-form";
import { toggleCarrierActiveAction } from "../actions";

export default async function CarriersPage() {
  const locale = await getLocale();
  const t = await getTranslations("tms");
  const tc = await getTranslations("common");
  const session = await getSession();
  const canManage =
    !!session &&
    (session.perms.includes("*") || session.perms.includes("tms.manage"));

  const num = (n: number, d = 0) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: d }).format(n);

  const carriers = await listCarriers();

  return (
    <div className="space-y-4">
      <PageHeader title={t("carriers")}>
        <Link
          href="/tms"
          className="text-sm text-muted hover:text-foreground"
        >
          ← {t("title")}
        </Link>
      </PageHeader>

      {canManage && (
        <CollapsibleCard title={t("newCarrier")}>
          <CarrierForm />
        </CollapsibleCard>
      )}

      <TableWrap>
        <thead>
          <tr>
            <Th>{t("carrierName")}</Th>
            <Th>{t("phone")}</Th>
            <Th>{t("truckPlate")}</Th>
            <Th>{t("truckType")}</Th>
            <Th className="text-right">{t("capacityKg")}</Th>
            <Th className="text-right">{t("capacityM3")}</Th>
            {canManage && <Th className="text-right">{tc("actions")}</Th>}
          </tr>
        </thead>
        <tbody>
          {carriers.length === 0 ? (
            <EmptyRow colSpan={canManage ? 7 : 6} text={t("noCarriers")} />
          ) : (
            carriers.map((c) => (
              <TRow key={c.id} className={c.isActive ? "" : "opacity-50"}>
                <Td className="font-medium">
                  {c.name}
                  {!c.isActive && (
                    <Badge className="ml-2 bg-surface-2 text-muted">
                      {t("inactive")}
                    </Badge>
                  )}
                </Td>
                <Td className="whitespace-nowrap text-muted">{c.phone ?? "—"}</Td>
                <Td className="font-mono text-xs">{c.truckPlate ?? "—"}</Td>
                <Td className="text-muted">{c.truckType ?? "—"}</Td>
                <Td className="text-right font-mono tabular-nums">
                  {c.capacityKg ? num(Number(c.capacityKg)) : "—"}
                </Td>
                <Td className="text-right font-mono tabular-nums">
                  {c.capacityM3 ? num(Number(c.capacityM3), 1) : "—"}
                </Td>
                {canManage && (
                  <Td className="text-right">
                    <form
                      action={toggleCarrierActiveAction.bind(
                        null,
                        c.id,
                        !c.isActive,
                      )}
                    >
                      <Button type="submit" size="sm" variant="outline">
                        {c.isActive ? t("deactivate") : t("activate")}
                      </Button>
                    </form>
                  </Td>
                )}
              </TRow>
            ))
          )}
        </tbody>
      </TableWrap>
    </div>
  );
}
