import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { getBatch, getAvailableCargos } from "@/modules/tms/service";
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
import {
  startLoadingAction,
  departAction,
  arriveAction,
  unloadAction,
  closeAction,
  addCargoAction,
  removeCargoAction,
} from "../actions";
import { PrintButton } from "./print-button";
import { ScanPanel } from "./scan-panel";

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
  const tcs = await getTranslations("cargoStatus");

  const {
    batch,
    origin,
    dest,
    carrier,
    items,
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
  const available =
    editable && canLoad ? await getAvailableCargos(id) : [];

  const capKg = carrier?.capacityKg ? Number(carrier.capacityKg) : null;
  const capM3 = carrier?.capacityM3 ? Number(carrier.capacityM3) : null;

  return (
    <div className="space-y-4">
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
              <span className="font-medium text-foreground">
                {origin?.name}
              </span>
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
            {(batch.status === "planned" || batch.status === "loading") && (
              <ActionForm
                action={departAction.bind(null, id)}
                label={t("depart")}
                disabled={!loadComplete}
              />
            )}
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

      {/* ─── Sig'im to'ldirilishi ─── */}
      {carrier && (capKg || capM3) && (
        <Card className="p-4 print:hidden">
          <div className="mb-2 text-sm font-semibold text-muted">
            {t("capacity")}
          </div>
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

      {/* ─── Jamlar ─── */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard value={num(totals.totalVolumeM3, 2)} label={`${t("volume")}, m³`} />
        <StatCard value={num(totals.totalWeightKg)} label={`${t("weight")}, kg`} />
        <StatCard value={num(totals.cargoCount)} label={t("cargos")} />
      </div>

      {/* ─── Manifest (partiya tarkibi) ─── */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted">
            {t("manifest")}
          </h2>
          <PrintButton label={t("printManifest")} />
        </div>
        <div className="mb-2 hidden text-lg font-bold print:block">
          {t("manifest")} — {batch.code} ({origin?.name} → {dest?.name})
        </div>
        <TableWrap>
          <thead>
            <tr>
              <Th>{t("client")}</Th>
              <Th>{t("regNumber")}</Th>
              <Th>{t("status")}</Th>
              <Th className="text-right">{t("boxes")}</Th>
              <Th className="text-right">{t("weight")}</Th>
              <Th className="text-right">{t("volume")}</Th>
              <Th className="text-center print:hidden">{t("scanCol")}</Th>
              {editable && canLoad && <Th className="w-10 print:hidden" />}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <EmptyRow colSpan={editable && canLoad ? 8 : 7} text={t("noCargo")} />
            ) : (
              items.map((i) => (
                <TRow key={i.cargoId}>
                  <Td>
                    <span className="font-mono text-xs font-bold">
                      {i.clientCode}
                    </span>
                    <span className="ml-1.5 text-muted">{i.clientName}</span>
                  </Td>
                  <Td className="font-mono text-xs">{i.regNumber}</Td>
                  <Td>
                    <Badge className="bg-surface-2 text-muted">
                      {tcs(i.status as "received_cn")}
                    </Badge>
                  </Td>
                  <Td className="text-right font-mono tabular-nums">
                    {num(i.boxes)}
                  </Td>
                  <Td className="text-right font-mono tabular-nums">
                    {num(i.kg, 1)}
                  </Td>
                  <Td className="text-right font-mono tabular-nums">
                    {num(i.m3, 2)}
                  </Td>
                  <Td className="text-center print:hidden">
                    <ScanCell
                      scan={i.scan}
                      phase={unloadable || batch.status === "unloaded" ? "unload" : "load"}
                    />
                  </Td>
                  {editable && canLoad && (
                    <Td className="print:hidden">
                      <form action={removeCargoAction.bind(null, id, i.cargoId)}>
                        <button
                          type="submit"
                          title={t("remove")}
                          className="text-muted hover:text-red-600"
                        >
                          {icons.close("h-5 w-5")}
                        </button>
                      </form>
                    </Td>
                  )}
                </TRow>
              ))
            )}
          </tbody>
        </TableWrap>
      </div>

      {/* ─── Ombordagi tayyor yuklar (qo'shish uchun) ─── */}
      {editable && canLoad && (
        <div className="print:hidden">
          <h2 className="mb-2 text-sm font-semibold text-muted">
            {t("availableAtOrigin", { wh: origin?.name ?? "" })}
          </h2>
          <TableWrap>
            <thead>
              <tr>
                <Th>{t("client")}</Th>
                <Th>{t("regNumber")}</Th>
                <Th className="text-right">{t("boxes")}</Th>
                <Th className="text-right">{t("weight")}</Th>
                <Th className="text-right">{t("volume")}</Th>
                <Th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {available.length === 0 ? (
                <EmptyRow colSpan={6} text={t("noAvailable")} />
              ) : (
                available.map((c) => (
                  <TRow key={c.cargoId}>
                    <Td>
                      <span className="font-mono text-xs font-bold">
                        {c.clientCode}
                      </span>
                      <span className="ml-1.5 text-muted">{c.clientName}</span>
                    </Td>
                    <Td className="font-mono text-xs">{c.regNumber}</Td>
                    <Td className="text-right font-mono tabular-nums">
                      {num(c.boxes)}
                    </Td>
                    <Td className="text-right font-mono tabular-nums">
                      {num(Number(c.kg), 1)}
                    </Td>
                    <Td className="text-right font-mono tabular-nums">
                      {num(Number(c.m3), 2)}
                    </Td>
                    <Td>
                      <form action={addCargoAction.bind(null, id, c.cargoId)}>
                        <Button type="submit" size="sm" variant="outline">
                          {t("add")}
                        </Button>
                      </form>
                    </Td>
                  </TRow>
                ))
              )}
            </tbody>
          </TableWrap>
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

function ScanCell({
  scan,
  phase,
}: {
  scan: { total: number; loaded: number; unloaded: number; missing: number };
  phase: "load" | "unload";
}) {
  const done = phase === "load" ? scan.loaded : scan.unloaded;
  const full = scan.total > 0 && done >= scan.total;
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={
          "font-mono text-xs tabular-nums " +
          (full ? "font-semibold text-emerald-600" : "text-muted")
        }
      >
        {done}/{scan.total}
      </span>
      {scan.missing > 0 && (
        <span className="rounded-full bg-red-100 px-1.5 text-[10px] font-semibold text-red-700 dark:bg-red-900 dark:text-red-200">
          −{scan.missing}
        </span>
      )}
    </span>
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
