import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import {
  getStockOverview,
  getWarehouseStock,
  getWarehouseBoxes,
  type WarehouseStock,
} from "@/modules/stock/service";
import {
  AGE_BUCKETS,
  ageBucket,
  utilization,
  truckNeeded,
  type Buckets,
} from "@/modules/stock/dto";
import {
  PageHeader,
  Card,
  StatCard,
  Badge,
} from "@/components/ui";
import { icons } from "@/components/icons";
import { ExportLink } from "@/components/export-link";
import { getSession } from "@/modules/shared/auth";
import { WarehouseDetail } from "./warehouse-detail";

// Yotish muddati guruhlari uchun rang.
const bucketColor: Record<string, string> = {
  fresh: "bg-emerald-500",
  warn: "bg-amber-500",
  old: "bg-orange-500",
  critical: "bg-red-500",
};
const bucketBadge: Record<string, string> = {
  fresh: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  warn: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  old: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

type SortKey = "urgent" | "volume" | "age" | "name";
const SORTS: SortKey[] = ["urgent", "volume", "age", "name"];

// Bandlik foizi → rang (bar va matn).
function utilColor(pct: number | null): string {
  if (pct == null) return "bg-surface-2";
  if (pct >= 90) return "bg-red-500";
  if (pct >= 80) return "bg-orange-500";
  if (pct >= 60) return "bg-amber-500";
  return "bg-emerald-500";
}

function sortWarehouses(list: WarehouseStock[], key: SortKey): WarehouseStock[] {
  const util = (w: WarehouseStock) =>
    utilization(w.totalVolumeM3, w.totalWeightKg, w.capacityM3, w.capacityKg).pct;
  const arr = [...list];
  if (key === "volume") arr.sort((a, b) => b.totalVolumeM3 - a.totalVolumeM3);
  else if (key === "age") arr.sort((a, b) => b.oldestDays - a.oldestDays);
  else if (key === "name") arr.sort((a, b) => a.gsCode.localeCompare(b.gsCode));
  else {
    // urgent: mashina kerak bo'lganlar tepada, so'ng bandlik, so'ng eng eski.
    arr.sort((a, b) => {
      const ua = util(a),
        ub = util(b);
      const na = truckNeeded(ua, a.oldestDays) ? 1 : 0;
      const nb = truckNeeded(ub, b.oldestDays) ? 1 : 0;
      if (na !== nb) return nb - na;
      if ((ub ?? -1) !== (ua ?? -1)) return (ub ?? -1) - (ua ?? -1);
      return b.oldestDays - a.oldestDays;
    });
  }
  return arr;
}

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{ wh?: string; sort?: string; tab?: string }>;
}) {
  const { wh, sort } = await searchParams;
  const locale = await getLocale();
  const t = await getTranslations("stock");

  const num = (n: number, digits = 0) =>
    new Intl.NumberFormat(locale, {
      maximumFractionDigits: digits,
      minimumFractionDigits: 0,
    }).format(n);

  if (wh) {
    const [detail, boxData] = await Promise.all([
      getWarehouseStock(wh),
      getWarehouseBoxes(wh),
    ]);
    if (detail) {
      const ts = await getTranslations("cargoStatus");
      const session = await getSession();
      const canLoad = Boolean(
        session?.perms.includes("*") || session?.perms.includes("tms.manage"),
      );
      const loadingHref =
        detail.warehouse.kind === "consolidation" ? "/tms/consolidation" : "/tms";
      return (
        <WarehouseDetail
          detail={detail}
          boxes={boxData?.boxes ?? []}
          locale={locale}
          labels={pickDetailLabels(t, ts)}
          canLoad={canLoad}
          loadingHref={loadingHref}
        />
      );
    }
  }

  const { warehouses, totals } = await getStockOverview();
  const sortKey: SortKey = (SORTS as string[]).includes(sort ?? "")
    ? (sort as SortKey)
    : "urgent";
  const sorted = sortWarehouses(warehouses, sortKey);
  const alerts = sorted.filter((w) => {
    const p = utilization(w.totalVolumeM3, w.totalWeightKg, w.capacityM3, w.capacityKg).pct;
    return w.cargoCount > 0 && truckNeeded(p, w.oldestDays);
  }).length;

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")}>
        <ExportLink type="stock" label={t("exportCsv")} />
      </PageHeader>
      <p className="-mt-2 text-sm text-muted">{t("subtitle")}</p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard value={num(totals.totalVolumeM3, 2)} label={t("totalVolume")} />
        <StatCard value={num(totals.totalWeightKg, 0)} label={t("totalWeight")} />
        <StatCard value={num(totals.totalBoxes)} label={t("totalBoxes")} />
        <StatCard value={num(totals.clientCount)} label={t("clients")} />
      </div>

      {/* Saralash + ogohlantirish soni */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-muted">{t("sortBy")}:</span>
          {SORTS.map((s) => (
            <Link
              key={s}
              href={s === "urgent" ? "/stock" : `/stock?sort=${s}`}
              className={
                "rounded-full px-3 py-1 text-xs font-medium transition-colors " +
                (s === sortKey
                  ? "bg-primary text-white"
                  : "bg-surface-2 text-muted hover:text-foreground")
              }
            >
              {t(`sort_${s}` as "sort_urgent")}
            </Link>
          ))}
        </div>
        {alerts > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800 dark:bg-red-900 dark:text-red-200">
            🚚 {t("truckNeededN", { n: alerts })}
          </span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {sorted.map((w) => {
          const empty = w.cargoCount === 0;
          const util = utilization(
            w.totalVolumeM3,
            w.totalWeightKg,
            w.capacityM3,
            w.capacityKg,
          );
          const needTruck = !empty && truckNeeded(util.pct, w.oldestDays);
          const card = (
            <Card
              className={
                "h-full p-4 " +
                (needTruck ? "ring-2 ring-red-400/60 dark:ring-red-500/40" : "")
              }
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold">{w.gsCode}</span>
                    <span className="truncate font-semibold">{w.name}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge className="bg-surface-2 text-muted">
                      {w.country === "CN" ? "🇨🇳" : "🇺🇿"} {w.country}
                    </Badge>
                    <Badge className="bg-surface-2 text-muted">
                      {t(`kind_${w.kind}` as "kind_receiving")}
                    </Badge>
                    {needTruck && (
                      <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                        🚚 {t("truckNeeded")}
                      </Badge>
                    )}
                  </div>
                </div>
                {!empty && (
                  <span className="shrink-0 text-muted">
                    {icons.cargo("h-5 w-5")}
                  </span>
                )}
              </div>

              {empty ? (
                <div className="mt-6 mb-2 text-center text-sm text-muted">
                  {t("empty")}
                </div>
              ) : (
                <>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="font-mono text-lg font-bold tabular-nums">
                        {num(w.totalVolumeM3, 2)}
                      </div>
                      <div className="text-[11px] text-muted">{t("m3")}</div>
                    </div>
                    <div>
                      <div className="font-mono text-lg font-bold tabular-nums">
                        {num(w.totalWeightKg, 0)}
                      </div>
                      <div className="text-[11px] text-muted">{t("kg")}</div>
                    </div>
                    <div>
                      <div className="font-mono text-lg font-bold tabular-nums">
                        {num(w.totalBoxes)}
                      </div>
                      <div className="text-[11px] text-muted">{t("boxes")}</div>
                    </div>
                  </div>

                  {/* Bandlik (sig'im belgilangan bo'lsa) */}
                  {util.pct != null && (
                    <div className="mt-4">
                      <div className="mb-1 flex items-center justify-between text-[11px] text-muted">
                        <span>{t("utilization")}</span>
                        <span
                          className={
                            "font-mono font-bold tabular-nums " +
                            (util.pct >= 80
                              ? "text-red-600 dark:text-red-400"
                              : "")
                          }
                        >
                          {num(util.pct, 0)}%
                        </span>
                      </div>
                      <div className="flex h-2 overflow-hidden rounded-full bg-surface-2">
                        <div
                          className={utilColor(util.pct)}
                          style={{ width: `${Math.min(100, util.pct)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <AgeBar buckets={w.buckets} total={w.cargoCount} t={t} />

                  <div className="mt-3 flex items-center justify-between text-xs text-muted">
                    <span>{t("clientsN", { n: w.clientCount })}</span>
                    <span
                      className={
                        "rounded-full px-2 py-0.5 font-medium " +
                        bucketBadge[ageBucket(w.oldestDays)]
                      }
                    >
                      {t("oldestDays", { n: w.oldestDays })}
                    </span>
                  </div>
                </>
              )}
            </Card>
          );
          return empty ? (
            <div key={w.id}>{card}</div>
          ) : (
            <Link
              key={w.id}
              href={`/stock?wh=${w.id}`}
              className="block transition-transform hover:-translate-y-0.5"
            >
              {card}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Yotish muddati chizig'i (stacked bar) ──────────────────────────── */

function AgeBar({
  buckets,
  total,
  t,
}: {
  buckets: Buckets;
  total: number;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  if (total === 0) return null;
  return (
    <div className="mt-4">
      <div className="flex h-2 overflow-hidden rounded-full bg-surface-2">
        {AGE_BUCKETS.map((b) =>
          buckets[b] > 0 ? (
            <div
              key={b}
              className={bucketColor[b]}
              style={{ width: `${(buckets[b] / total) * 100}%` }}
              title={`${t(`age_${b}` as "age_fresh")}: ${buckets[b]}`}
            />
          ) : null,
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted">
        {AGE_BUCKETS.filter((b) => buckets[b] > 0).map((b) => (
          <span key={b} className="inline-flex items-center gap-1">
            <span className={"h-2 w-2 rounded-full " + bucketColor[b]} />
            {t(`age_${b}` as "age_fresh")} · {buckets[b]}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── Tafsilot uchun tarjima yorliqlarini yig'ish (client komponentga) ── */

export type DetailLabels = Record<string, string> & {
  statuses: Record<string, string>;
};

function pickDetailLabels(
  t: Awaited<ReturnType<typeof getTranslations>>,
  ts: Awaited<ReturnType<typeof getTranslations>>,
): DetailLabels {
  const keys = [
    "backToOverview", "totalVolume", "totalWeight", "totalBoxes", "clients",
    "byClient", "client", "volume", "weight", "boxes", "cargos", "age", "empty",
    "cargoList", "regNumber", "status", "dayUnit", "kg", "m3",
    "tabClients", "tabCargos", "tabBoxes", "search", "filterAge", "all",
    "age_fresh", "age_warn", "age_old", "age_critical",
    "startLoading", "print", "stocktake", "utilization",
    "box", "product", "letter", "qr", "flag", "noMatch",
  ];
  const out = {} as DetailLabels;
  for (const k of keys) out[k] = t(k as "empty");
  out.statuses = {};
  for (const s of [
    "received_cn", "at_kashgar", "at_uz_warehouse", "uz_customs", "ready", "held",
    "in_transit_ksg", "in_transit_uz", "loaded", "delivered", "lost", "cn_customs",
  ]) {
    out.statuses[s] = ts(s as "received_cn");
  }
  return out;
}
