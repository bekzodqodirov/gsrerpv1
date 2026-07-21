import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { getStockOverview, getWarehouseStock } from "@/modules/stock/service";
import { AGE_BUCKETS, ageBucket, type Buckets } from "@/modules/stock/dto";
import { statusColors } from "@/components/cargo-status";
import {
  PageHeader,
  Card,
  StatCard,
  Badge,
  TableWrap,
  Th,
  Td,
  TRow,
  EmptyRow,
} from "@/components/ui";
import { icons } from "@/components/icons";

// Yotish muddati guruhlari uchun rang (AgeBar va badge'lar).
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

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{ wh?: string }>;
}) {
  const { wh } = await searchParams;
  const locale = await getLocale();
  const t = await getTranslations("stock");

  // Sonlarni til bo'yicha formatlash:
  const num = (n: number, digits = 0) =>
    new Intl.NumberFormat(locale, {
      maximumFractionDigits: digits,
      minimumFractionDigits: 0,
    }).format(n);
  const kg = (n: number) => `${num(n, 1)} ${t("kg")}`;
  const m3 = (n: number) => `${num(n, 2)} ${t("m3")}`;

  const detail = wh ? await getWarehouseStock(wh) : null;

  if (wh && detail) {
    return (
      <WarehouseDetail detail={detail} t={t} num={num} kg={kg} m3={m3} />
    );
  }

  const { warehouses, totals } = await getStockOverview();

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} />
      <p className="-mt-2 text-sm text-muted">{t("subtitle")}</p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard value={num(totals.totalVolumeM3, 2)} label={t("totalVolume")} />
        <StatCard value={num(totals.totalWeightKg, 0)} label={t("totalWeight")} />
        <StatCard value={num(totals.totalBoxes)} label={t("totalBoxes")} />
        <StatCard value={num(totals.clientCount)} label={t("clients")} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {warehouses.map((w) => {
          const empty = w.cargoCount === 0;
          const card = (
              <Card className="h-full p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold">
                        {w.gsCode}
                      </span>
                      <span className="truncate font-semibold">{w.name}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge className="bg-surface-2 text-muted">
                        {w.country === "CN" ? "🇨🇳" : "🇺🇿"} {w.country}
                      </Badge>
                      <Badge className="bg-surface-2 text-muted">
                        {t(`kind_${w.kind}` as "kind_receiving")}
                      </Badge>
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
                        <div className="text-[11px] text-muted">
                          {t("boxes")}
                        </div>
                      </div>
                    </div>

                    <AgeBar buckets={w.buckets} total={w.cargoCount} t={t} />

                    <div className="mt-3 flex items-center justify-between text-xs text-muted">
                      <span>
                        {t("clientsN", { n: w.clientCount })}
                      </span>
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

/* ─── Bitta ombor tafsiloti ──────────────────────────────────────────── */

async function WarehouseDetail({
  detail,
  t,
  num,
  kg,
  m3,
}: {
  detail: NonNullable<Awaited<ReturnType<typeof getWarehouseStock>>>;
  t: Awaited<ReturnType<typeof getTranslations>>;
  num: (n: number, digits?: number) => string;
  kg: (n: number) => string;
  m3: (n: number) => string;
}) {
  const ts = await getTranslations("cargoStatus");
  const { warehouse: w, clients, cargos, totals } = detail;

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/stock"
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg"
        >
          ← {t("backToOverview")}
        </Link>
        <PageHeader
          title={
            <span className="flex items-center gap-2">
              <span className="font-mono text-base font-bold text-muted">
                {w.gsCode}
              </span>
              {w.name}
            </span>
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard value={num(totals.totalVolumeM3, 2)} label={t("totalVolume")} />
        <StatCard value={num(totals.totalWeightKg, 0)} label={t("totalWeight")} />
        <StatCard value={num(totals.totalBoxes)} label={t("totalBoxes")} />
        <StatCard value={num(totals.clientCount)} label={t("clients")} />
      </div>

      {/* Mijozlar kesimi — kim eng ko'p yotib qolgan */}
      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted">
          {t("byClient")}
        </h2>
        <TableWrap>
          <thead>
            <tr>
              <Th>{t("client")}</Th>
              <Th className="text-right">{t("volume")}</Th>
              <Th className="text-right">{t("weight")}</Th>
              <Th className="text-right">{t("boxes")}</Th>
              <Th className="text-right">{t("cargos")}</Th>
              <Th className="text-right">{t("age")}</Th>
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 ? (
              <EmptyRow colSpan={6} text={t("empty")} />
            ) : (
              clients.map((c) => (
                <TRow key={c.clientId}>
                  <Td>
                    <div className="font-mono text-xs font-bold">{c.code}</div>
                    <div className="text-muted">{c.name}</div>
                  </Td>
                  <Td className="text-right font-mono tabular-nums">
                    {m3(c.totalVolumeM3)}
                  </Td>
                  <Td className="text-right font-mono tabular-nums">
                    {kg(c.totalWeightKg)}
                  </Td>
                  <Td className="text-right font-mono tabular-nums">
                    {num(c.totalBoxes)}
                  </Td>
                  <Td className="text-right font-mono tabular-nums">
                    {num(c.cargoCount)}
                  </Td>
                  <Td className="text-right">
                    <Badge className={bucketBadge[ageBucket(c.oldestDays)]}>
                      {t("daysN", { n: c.oldestDays })}
                    </Badge>
                  </Td>
                </TRow>
              ))
            )}
          </tbody>
        </TableWrap>
      </div>

      {/* Yuklar ro'yxati — FIFO (eng eski birinchi) */}
      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted">
          {t("cargoList")}
        </h2>
        <TableWrap>
          <thead>
            <tr>
              <Th>{t("regNumber")}</Th>
              <Th>{t("client")}</Th>
              <Th>{t("status")}</Th>
              <Th className="text-right">{t("volume")}</Th>
              <Th className="text-right">{t("weight")}</Th>
              <Th className="text-right">{t("boxes")}</Th>
              <Th className="text-right">{t("age")}</Th>
            </tr>
          </thead>
          <tbody>
            {cargos.length === 0 ? (
              <EmptyRow colSpan={7} text={t("empty")} />
            ) : (
              cargos.map((c) => (
                <TRow key={c.cargoId}>
                  <Td className="font-mono text-xs font-semibold">
                    <Link
                      href={`/cargo/${c.cargoId}`}
                      className="text-primary hover:underline"
                    >
                      {c.regNumber}
                    </Link>
                  </Td>
                  <Td>
                    <span className="font-mono text-xs font-bold">
                      {c.clientCode}
                    </span>
                  </Td>
                  <Td>
                    <Badge className={statusColors[c.status] ?? ""}>
                      {ts(c.status as "received_cn")}
                    </Badge>
                  </Td>
                  <Td className="text-right font-mono tabular-nums">
                    {m3(c.volumeM3)}
                  </Td>
                  <Td className="text-right font-mono tabular-nums">
                    {kg(c.weightKg)}
                  </Td>
                  <Td className="text-right font-mono tabular-nums">
                    {num(c.boxes)}
                  </Td>
                  <Td className="text-right">
                    <Badge className={bucketBadge[ageBucket(c.days)]}>
                      {t("daysN", { n: c.days })}
                    </Badge>
                  </Td>
                </TRow>
              ))
            )}
          </tbody>
        </TableWrap>
      </div>
    </div>
  );
}
