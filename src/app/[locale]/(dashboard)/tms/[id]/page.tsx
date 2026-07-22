import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { getBatch, getAvailableLines } from "@/modules/tms/service";
import { batchStatusColors } from "@/components/batch-status";
import {
  Card,
  Badge,
  Button,
  StatCard,
  TableWrap,
  Th,
  Td,
  TRow,
  EmptyRow,
} from "@/components/ui";
import { icons } from "@/components/icons";
import { PhotoThumbs } from "@/components/photo-lightbox";
import {
  startLoadingAction,
  departAction,
  arriveAction,
  unloadAction,
  closeAction,
} from "../actions";
import { PrintButton } from "./print-button";
import { ScanPanel } from "./scan-panel";
import { DepartPartial } from "./depart-partial";
import { PlanBuilder } from "./plan-builder";
import { PlanLineControls } from "./plan-line-controls";
import { AutoRefresh } from "./auto-refresh";

export default async function BatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getBatch(id);
  if (!data) notFound();

  const locale = await getLocale();
  const t = await getTranslations("tms");
  const ts = await getTranslations("batchStatus");

  const {
    batch,
    origin,
    dest,
    carrier,
    lines,
    workers,
    totals,
    canManage,
    canLoad,
    loadProgress,
    unloadProgress,
    missingCount,
  } = data;

  const num = (n: number, d = 0) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: d }).format(n);

  const editable = batch.status === "planned" || batch.status === "loading";
  const unloadable = batch.status === "departed" || batch.status === "arrived";
  const loadComplete =
    loadProgress.total > 0 && loadProgress.done >= loadProgress.total;
  const available = editable && canLoad ? await getAvailableLines(id) : [];

  const capKg = carrier?.capacityKg ? Number(carrier.capacityKg) : null;
  const capM3 = carrier?.capacityM3 ? Number(carrier.capacityM3) : null;

  const partialItems = lines
    .filter((l) => l.loaded < l.planned)
    .map((l) => ({
      id: l.lineId,
      title: `${l.clientCode}-${l.letterCode} · ${l.productName}`,
      loaded: l.loaded,
      planned: l.planned,
    }));

  return (
    <div className="space-y-4">
      {/* Ishchilar scan qilganda sahifa jonli yangilanib turadi */}
      {(editable || unloadable) && canLoad && <AutoRefresh seconds={8} />}

      {/* ─── Sarlavha ─── */}
      <div className="print:hidden">
        <Link
          href="/tms"
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
        >
          ← {t("allBatches")}
        </Link>
      </div>

      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-mono text-2xl font-bold tracking-tight">
                {batch.code}
              </h1>
              <Badge className={batchStatusColors[batch.status] ?? ""}>
                {ts(batch.status as "planned")}
              </Badge>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm text-muted">
              <span className="font-medium text-foreground">{origin?.name}</span>
              <span>→</span>
              <span className="font-medium text-foreground">{dest?.name}</span>
            </div>
            {carrier && (
              <div className="mt-1 text-sm text-muted">
                {t("carrier")}: {carrier.name}
                {carrier.truckPlate ? ` · ${carrier.truckPlate}` : ""}
                {carrier.phone ? ` · ${carrier.phone}` : ""}
              </div>
            )}
            {batch.sealNumber && (
              <div className="mt-1 text-sm text-muted">
                {t("sealNumber")}: <span className="font-mono">{batch.sealNumber}</span>
              </div>
            )}
          </div>
          {canManage && batch.agreedPrice && (
            <div className="text-right">
              <div className="font-mono text-lg font-bold tabular-nums">
                {num(Number(batch.agreedPrice), 2)} {batch.currency}
              </div>
              <div className="text-xs text-muted">{t("agreedPrice")}</div>
            </div>
          )}
        </div>

        {/* ─── Holat amallari ─── */}
        {canLoad && (
          <div className="mt-4 flex flex-wrap gap-2 print:hidden">
            {batch.status === "planned" && (
              <ActionForm action={startLoadingAction.bind(null, id)} label={t("startLoading")} variant="outline" />
            )}
            {(batch.status === "planned" || batch.status === "loading") &&
              (loadComplete ? (
                <ActionForm action={departAction.bind(null, id)} label={t("depart")} />
              ) : loadProgress.done > 0 ? (
                <DepartPartial
                  batchId={id}
                  totalUnscanned={loadProgress.total - loadProgress.done}
                  items={partialItems}
                />
              ) : (
                <ActionForm
                  action={departAction.bind(null, id)}
                  label={t("depart")}
                  disabled
                />
              ))}
            {editable && !loadComplete && loadProgress.total > 0 && (
              <span className="self-center text-xs text-muted">
                {t("departBlocked", {
                  done: loadProgress.done,
                  total: loadProgress.total,
                })}
              </span>
            )}
            {batch.status === "departed" && (
              <ActionForm action={arriveAction.bind(null, id)} label={t("arrive")} variant="outline" />
            )}
            {(batch.status === "departed" || batch.status === "arrived") && (
              <ActionForm action={unloadAction.bind(null, id)} label={t("unload")} />
            )}
            {batch.status === "unloaded" && canManage && (
              <ActionForm action={closeAction.bind(null, id)} label={t("close")} variant="outline" />
            )}
          </div>
        )}
      </Card>

      {/* ─── Sig'im to'ldirilishi (plan bo'yicha) ─── */}
      {carrier && (capKg || capM3) && (
        <Card className="p-4 print:hidden">
          <div className="mb-2 text-sm font-semibold text-muted">{t("capacity")}</div>
          <div className="space-y-3">
            {capKg && (
              <FillBar
                label={t("weight")}
                value={totals.totalWeightKg}
                max={capKg}
                unit="kg"
                num={num}
              />
            )}
            {capM3 && (
              <FillBar
                label={t("volume")}
                value={totals.totalVolumeM3}
                max={capM3}
                unit="m³"
                num={num}
              />
            )}
          </div>
        </Card>
      )}

      {/* ─── Karobka scan (yuklash / tushirish) ─── */}
      {editable && canLoad && loadProgress.total > 0 && (
        <ScanPanel
          batchId={id}
          mode="load"
          done={loadProgress.done}
          total={loadProgress.total}
        />
      )}
      {unloadable && canLoad && (
        <ScanPanel
          batchId={id}
          mode="unload"
          done={unloadProgress.done}
          total={unloadProgress.total}
        />
      )}
      {missingCount > 0 && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300 print:hidden">
          ⚠ {t("missingBoxes", { n: missingCount })}
        </div>
      )}

      {/* ─── Jamlar (plan) ─── */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard value={num(totals.totalBoxes)} label={t("boxes")} />
        <StatCard value={num(totals.totalVolumeM3, 2)} label={`${t("volume")}, m³`} />
        <StatCard value={num(totals.totalWeightKg)} label={`${t("weight")}, kg`} />
        <StatCard value={num(totals.lineCount)} label={t("products")} />
      </div>

      {/* ─── Ishchilar hisobi: kim nechta karobka yukladi ─── */}
      {workers.length > 0 && (
        <Card className="p-3 print:hidden">
          <div className="mb-1.5 text-[11px] font-bold tracking-wider text-muted uppercase">
            {t("workers")}
          </div>
          <div className="flex flex-wrap gap-2">
            {workers.map((w, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-sm"
              >
                {w.name}
                <span className="font-mono font-bold tabular-nums text-primary">
                  {w.n}
                </span>
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* ─── Ish varag'i / manifest (tovar darajasida, zona tartibida) ─── */}
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-muted">{t("manifest")}</h2>
          <div className="flex items-center gap-2 print:hidden">
            <a
              href={`/api/export?type=batchplan&batch=${id}`}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm font-medium hover:bg-surface-2"
            >
              {icons.stock("h-4 w-4")}
              {t("excel")}
            </a>
            <PrintButton label={t("printManifest")} />
          </div>
        </div>
        <div className="mb-2 hidden text-lg font-bold print:block">
          {t("manifest")} — {batch.code} ({origin?.name} → {dest?.name})
        </div>
        <TableWrap>
          <thead>
            <tr>
              <Th className="print:hidden">{t("photo")}</Th>
              <Th>{t("zone")}</Th>
              <Th>{t("product")}</Th>
              <Th className="text-right">{t("planCol")}</Th>
              <Th className="text-right">{t("loadedCol")}</Th>
              <Th className="text-right">{t("remainingCol")}</Th>
              <Th className="text-right">{t("weight")}</Th>
              <Th className="text-right">{t("volume")}</Th>
              {editable && canLoad && <Th className="w-24 print:hidden" />}
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <EmptyRow colSpan={editable && canLoad ? 9 : 8} text={t("noCargo")} />
            ) : (
              lines.map((l) => {
                const remaining = Math.max(0, l.planned - l.loaded);
                const complete = l.planned > 0 && l.loaded >= l.planned;
                return (
                  <TRow key={l.lineId}>
                    <Td className="print:hidden">
                      {l.photoId ? (
                        <PhotoThumbs
                          photos={[{ id: l.photoId, name: l.productName }]}
                          thumbClass="h-10 w-10"
                        />
                      ) : (
                        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-2 text-muted">
                          {icons.camera("h-4 w-4")}
                        </span>
                      )}
                    </Td>
                    <Td>
                      {l.zone ? (
                        <span className="rounded-md bg-primary-soft px-2 py-0.5 font-mono text-xs font-bold text-primary">
                          {l.zone}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </Td>
                    <Td>
                      <div className="font-mono text-sm font-black">
                        {l.clientCode}-{l.letterCode}
                      </div>
                      <div className="max-w-52 truncate text-sm">{l.productName}</div>
                      <div className="font-mono text-[11px] text-muted">
                        {l.regNumber}
                        {l.missing > 0 && (
                          <span className="ml-1.5 rounded-full bg-red-100 px-1.5 text-[10px] font-semibold text-red-700 dark:bg-red-900 dark:text-red-200">
                            −{l.missing}
                          </span>
                        )}
                      </div>
                    </Td>
                    <Td className="text-right font-mono tabular-nums">{num(l.planned)}</Td>
                    <Td className="text-right">
                      <span
                        className={
                          "font-mono font-semibold tabular-nums " +
                          (complete ? "text-emerald-600" : "")
                        }
                      >
                        {unloadable || batch.status === "unloaded"
                          ? `${l.unloaded}/${l.loaded}`
                          : num(l.loaded)}
                      </span>
                    </Td>
                    <Td className="text-right">
                      {editable ? (
                        remaining > 0 ? (
                          <span className="rounded-md bg-amber-100 px-2 py-0.5 font-mono text-xs font-bold text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                            {num(remaining)}
                          </span>
                        ) : (
                          <span className="font-semibold text-emerald-600">✓</span>
                        )
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </Td>
                    <Td className="text-right font-mono text-xs tabular-nums">
                      {num(l.plannedKg, 1)}
                    </Td>
                    <Td className="text-right font-mono text-xs tabular-nums">
                      {num(l.plannedM3, 2)}
                    </Td>
                    {editable && canLoad && (
                      <Td className="print:hidden">
                        <PlanLineControls
                          batchId={id}
                          lineId={l.lineId}
                          planned={l.planned}
                          loaded={l.loaded}
                        />
                      </Td>
                    )}
                  </TRow>
                );
              })
            )}
          </tbody>
        </TableWrap>
      </div>

      {/* ─── Plan tuzuvchi: ombordagi tovarlar (rasm/nom/o'lchamlar bilan) ─── */}
      {editable && canLoad && (
        <div className="print:hidden">
          <PlanBuilder
            batchId={id}
            lines={available}
            planKg={totals.totalWeightKg}
            planM3={totals.totalVolumeM3}
            capKg={capKg}
            capM3={capM3}
          />
        </div>
      )}
    </div>
  );
}

/* ─── Kichik yordamchi komponentlar ─── */

function ActionForm({
  action,
  label,
  variant = "primary",
  disabled,
}: {
  action: () => void;
  label: string;
  variant?: "primary" | "outline";
  disabled?: boolean;
}) {
  return (
    <form action={action}>
      <Button type="submit" variant={variant} disabled={disabled}>
        {label}
      </Button>
    </form>
  );
}

function FillBar({
  label,
  value,
  max,
  unit,
  num,
}: {
  label: string;
  value: number;
  max: number;
  unit: string;
  num: (n: number, d?: number) => string;
}) {
  const pct = Math.min(100, (value / max) * 100);
  const over = value > max;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className={"font-mono tabular-nums " + (over ? "text-red-600 font-semibold" : "text-foreground")}>
          {num(value, 1)} / {num(max, 1)} {unit} · {Math.round(pct)}%
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className={"h-full rounded-full " + (over ? "bg-red-500" : pct > 85 ? "bg-amber-500" : "bg-emerald-500")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
