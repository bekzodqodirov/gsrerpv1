import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { getSession } from "@/modules/shared/auth";
import { getKashgarConsolidation, getBatchFormData } from "@/modules/tms/service";
import {
  PageHeader,
  Card,
  CollapsibleCard,
  StatCard,
  Badge,
  Th,
  Td,
  TRow,
} from "@/components/ui";
import { BatchForm } from "../batch-form";

export default async function ConsolidationPage() {
  const locale = await getLocale();
  const t = await getTranslations("tms");
  const session = await getSession();
  const canManage =
    !!session &&
    (session.perms.includes("*") || session.perms.includes("tms.manage"));

  const num = (n: number, d = 0) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: d }).format(n);

  const [data, formData] = await Promise.all([
    getKashgarConsolidation(),
    canManage ? getBatchFormData() : Promise.resolve(null),
  ]);
  const { warehouse, clients, totals } = data;

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/tms"
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
        >
          ← {t("allBatches")}
        </Link>
        <PageHeader
          title={
            <span className="flex items-center gap-2">
              {t("consolidation")}
              {warehouse && (
                <span className="font-mono text-base font-normal text-muted">
                  {warehouse.gsCode} · {warehouse.name}
                </span>
              )}
            </span>
          }
        />
      </div>
      <p className="-mt-2 text-sm text-muted">{t("consolidationSubtitle")}</p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard value={num(totals.totalVolumeM3, 2)} label={t("totalVolume")} />
        <StatCard value={num(totals.totalWeightKg)} label={t("totalWeight")} />
        <StatCard value={num(totals.totalBoxes)} label={t("totalBoxes")} />
        <StatCard value={num(clients.length)} label={t("clients")} />
      </div>

      {canManage && formData && warehouse && (
        <CollapsibleCard title={t("newKaBatch")} defaultOpen={clients.length > 0}>
          <BatchForm
            warehouses={formData.warehouses.filter((w) => w.country === "UZ")}
            carriers={formData.carriers}
            fixedOrigin={{ id: warehouse.id, name: warehouse.name }}
          />
        </CollapsibleCard>
      )}

      {clients.length === 0 ? (
        <Card className="px-4 py-10 text-center text-sm text-muted">
          {t("consolidationEmpty")}
        </Card>
      ) : (
        <div className="space-y-3">
          {clients.map((c) => (
            <Card key={c.clientId} className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-2/50 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold">{c.code}</span>
                  <span className="font-medium">{c.name}</span>
                </div>
                <div className="flex gap-3 font-mono text-xs text-muted tabular-nums">
                  <span>{num(c.totalVolumeM3, 2)} m³</span>
                  <span>{num(c.totalWeightKg)} kg</span>
                  <span>
                    {num(c.totalBoxes)} {t("boxes")}
                  </span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <Th>{t("regNumber")}</Th>
                      <Th>{t("arrivedOn")}</Th>
                      <Th className="text-right">{t("boxes")}</Th>
                      <Th className="text-right">{t("weight")}</Th>
                      <Th className="text-right">{t("volume")}</Th>
                      <Th className="text-right">{t("status")}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.cargos.map((g) => (
                      <TRow key={g.cargoId}>
                        <Td className="font-mono text-xs">
                          <Link
                            href={`/cargo/${g.cargoId}`}
                            className="text-primary hover:underline"
                          >
                            {g.regNumber}
                          </Link>
                        </Td>
                        <Td>
                          {g.arrivedOn ? (
                            <Badge className="bg-surface-2 font-mono text-muted">
                              {g.arrivedOn}
                            </Badge>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </Td>
                        <Td className="text-right font-mono tabular-nums">
                          {num(g.boxes)}
                        </Td>
                        <Td className="text-right font-mono tabular-nums">
                          {num(g.weightKg, 1)}
                        </Td>
                        <Td className="text-right font-mono tabular-nums">
                          {num(g.volumeM3, 2)}
                        </Td>
                        <Td className="text-right">
                          {g.onOutbound ? (
                            <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                              {t("onOutbound")}
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                              {t("readyToLoad")}
                            </Badge>
                          )}
                        </Td>
                      </TRow>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
