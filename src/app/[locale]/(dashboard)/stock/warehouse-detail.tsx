"use client";

import { useCallback, useMemo, useState } from "react";
import { Link } from "@/i18n/routing";
import {
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
import { statusColors } from "@/components/cargo-status";
import { ageBucket, utilization, AGE_BUCKETS } from "@/modules/stock/dto";
import type { DetailLabels } from "./page";

const bucketBadge: Record<string, string> = {
  fresh: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  warn: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  old: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};
const utilColor = (pct: number | null) =>
  pct == null
    ? "bg-surface-2"
    : pct >= 90
      ? "bg-red-500"
      : pct >= 80
        ? "bg-orange-500"
        : pct >= 60
          ? "bg-amber-500"
          : "bg-emerald-500";

type ClientStock = {
  clientId: string;
  code: string;
  name: string;
  cargoCount: number;
  totalBoxes: number;
  totalWeightKg: number;
  totalVolumeM3: number;
  oldestDays: number;
};
type CargoStockRow = {
  cargoId: string;
  regNumber: string;
  status: string;
  clientCode: string;
  clientName: string;
  boxes: number;
  weightKg: number;
  volumeM3: number;
  days: number;
};
type WarehouseBox = {
  qrCode: string;
  boxNo: number;
  cargoId: string;
  regNumber: string;
  clientCode: string;
  clientName: string;
  letterCode: string;
  productName: string;
  days: number;
  flag: string | null;
};
type Detail = {
  warehouse: {
    id: string;
    gsCode: string;
    name: string;
    kind: string;
    capacityM3: string | null;
    capacityKg: string | null;
  };
  clients: ClientStock[];
  cargos: CargoStockRow[];
  totals: {
    cargoCount: number;
    clientCount: number;
    totalBoxes: number;
    totalWeightKg: number;
    totalVolumeM3: number;
  };
};

type Tab = "clients" | "cargos" | "boxes";
type AgeFilter = "all" | "fresh" | "warn" | "old" | "critical";

export function WarehouseDetail({
  detail,
  boxes,
  locale,
  labels,
  canLoad,
  loadingHref,
}: {
  detail: Detail;
  boxes: WarehouseBox[];
  locale: string;
  labels: DetailLabels;
  canLoad: boolean;
  loadingHref: string;
}) {
  const L = labels;
  const { warehouse: w, clients, cargos, totals } = detail;
  const [tab, setTab] = useState<Tab>("clients");
  const [q, setQ] = useState("");
  const [age, setAge] = useState<AgeFilter>("all");

  const num = (n: number, digits = 0) =>
    new Intl.NumberFormat(locale, {
      maximumFractionDigits: digits,
      minimumFractionDigits: 0,
    }).format(n);
  const kg = (n: number) => `${num(n, 1)} ${L.kg}`;
  const m3 = (n: number) => `${num(n, 2)} ${L.m3}`;

  const util = utilization(
    totals.totalVolumeM3,
    totals.totalWeightKg,
    w.capacityM3 != null ? Number(w.capacityM3) : null,
    w.capacityKg != null ? Number(w.capacityKg) : null,
  );

  const ql = q.trim().toLowerCase();
  const ageOk = useCallback(
    (days: number) => age === "all" || ageBucket(days) === age,
    [age],
  );

  const shownClients = useMemo(
    () =>
      clients.filter(
        (c) =>
          ageOk(c.oldestDays) &&
          (!ql ||
            c.code.toLowerCase().includes(ql) ||
            c.name.toLowerCase().includes(ql)),
      ),
    [clients, ql, ageOk],
  );
  const shownCargos = useMemo(
    () =>
      cargos.filter(
        (c) =>
          ageOk(c.days) &&
          (!ql ||
            c.regNumber.toLowerCase().includes(ql) ||
            c.clientCode.toLowerCase().includes(ql) ||
            c.clientName.toLowerCase().includes(ql)),
      ),
    [cargos, ql, ageOk],
  );
  const shownBoxes = useMemo(
    () =>
      boxes.filter(
        (b) =>
          ageOk(b.days) &&
          (!ql ||
            b.qrCode.toLowerCase().includes(ql) ||
            b.clientCode.toLowerCase().includes(ql) ||
            b.productName.toLowerCase().includes(ql) ||
            b.letterCode.toLowerCase().includes(ql)),
      ),
    [boxes, ql, ageOk],
  );

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "clients", label: L.tabClients, count: clients.length },
    { key: "cargos", label: L.tabCargos, count: cargos.length },
    { key: "boxes", label: L.tabBoxes, count: boxes.length },
  ];

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/stock"
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
        >
          ← {L.backToOverview}
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
            <span className="font-mono text-base font-bold text-muted">
              {w.gsCode}
            </span>
            {w.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            {canLoad && (
              <Link
                href={loadingHref}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-white hover:bg-primary-hover"
              >
                {icons.truck("h-4 w-4")}
                {L.startLoading}
              </Link>
            )}
            <Link
              href={`/stock/count?wh=${w.id}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-medium hover:bg-surface-2"
            >
              {icons.qr("h-4 w-4")}
              {L.stocktake}
            </Link>
            <a
              href={`/${locale}/stock/report?wh=${w.id}`}
              target="_blank"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-medium hover:bg-surface-2"
            >
              {icons.printer("h-4 w-4")}
              {L.print}
            </a>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard value={num(totals.totalVolumeM3, 2)} label={L.totalVolume} />
        <StatCard value={num(totals.totalWeightKg, 0)} label={L.totalWeight} />
        <StatCard value={num(totals.totalBoxes)} label={L.totalBoxes} />
        <StatCard value={num(totals.clientCount)} label={L.clients} />
      </div>

      {util.pct != null && (
        <Card className="p-3">
          <div className="mb-1 flex items-center justify-between text-xs text-muted">
            <span>{L.utilization}</span>
            <span
              className={
                "font-mono font-bold tabular-nums " +
                (util.pct >= 80 ? "text-red-600 dark:text-red-400" : "")
              }
            >
              {num(util.pct, 0)}%
            </span>
          </div>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className={utilColor(util.pct)}
              style={{ width: `${Math.min(100, util.pct)}%` }}
            />
          </div>
        </Card>
      )}

      {/* Tablar + qidiruv + yosh filtri */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1.5">
          {tabs.map((tb) => (
            <button
              key={tb.key}
              type="button"
              onClick={() => setTab(tb.key)}
              className={
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors " +
                (tab === tb.key
                  ? "bg-primary text-white"
                  : "bg-surface-2 text-muted hover:text-foreground")
              }
            >
              {tb.label}{" "}
              <span className="font-mono tabular-nums opacity-70">{tb.count}</span>
            </button>
          ))}
        </div>
        <div className="relative sm:w-64">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={L.search}
            className="h-9 w-full rounded-lg border border-line bg-surface px-3 pl-8 text-sm outline-none focus:border-primary"
          />
          <span className="pointer-events-none absolute top-2.5 left-2.5 text-muted">
            {icons.search("h-4 w-4")}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs text-muted">{L.filterAge}:</span>
        {(["all", ...AGE_BUCKETS] as AgeFilter[]).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAge(a)}
            className={
              "rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors " +
              (age === a
                ? "bg-foreground text-surface"
                : "bg-surface-2 text-muted hover:text-foreground")
            }
          >
            {a === "all" ? L.all : L[`age_${a}` as "age_fresh"]}
          </button>
        ))}
      </div>

      {tab === "clients" && (
        <TableWrap>
          <thead>
            <tr>
              <Th>{L.client}</Th>
              <Th className="text-right">{L.volume}</Th>
              <Th className="text-right">{L.weight}</Th>
              <Th className="text-right">{L.boxes}</Th>
              <Th className="text-right">{L.cargos}</Th>
              <Th className="text-right">{L.age}</Th>
            </tr>
          </thead>
          <tbody>
            {shownClients.length === 0 ? (
              <EmptyRow colSpan={6} text={L.noMatch} />
            ) : (
              shownClients.map((c) => (
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
                      {`${c.oldestDays} ${L.dayUnit}`}
                    </Badge>
                  </Td>
                </TRow>
              ))
            )}
          </tbody>
        </TableWrap>
      )}

      {tab === "cargos" && (
        <TableWrap>
          <thead>
            <tr>
              <Th>{L.regNumber}</Th>
              <Th>{L.client}</Th>
              <Th>{L.status}</Th>
              <Th className="text-right">{L.volume}</Th>
              <Th className="text-right">{L.weight}</Th>
              <Th className="text-right">{L.boxes}</Th>
              <Th className="text-right">{L.age}</Th>
            </tr>
          </thead>
          <tbody>
            {shownCargos.length === 0 ? (
              <EmptyRow colSpan={7} text={L.noMatch} />
            ) : (
              shownCargos.map((c) => (
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
                      {L.statuses[c.status] ?? c.status}
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
                      {`${c.days} ${L.dayUnit}`}
                    </Badge>
                  </Td>
                </TRow>
              ))
            )}
          </tbody>
        </TableWrap>
      )}

      {tab === "boxes" && (
        <TableWrap>
          <thead>
            <tr>
              <Th>{L.qr}</Th>
              <Th>{L.client}</Th>
              <Th>{L.letter}</Th>
              <Th>{L.product}</Th>
              <Th className="text-right">{L.age}</Th>
              <Th>{L.flag}</Th>
            </tr>
          </thead>
          <tbody>
            {shownBoxes.length === 0 ? (
              <EmptyRow colSpan={6} text={L.noMatch} />
            ) : (
              shownBoxes.map((b) => (
                <TRow key={b.qrCode}>
                  <Td className="font-mono text-xs font-semibold">
                    <Link
                      href={`/cargo/${b.cargoId}`}
                      className="text-primary hover:underline"
                    >
                      {b.qrCode}
                    </Link>
                  </Td>
                  <Td className="font-mono text-xs font-bold">{b.clientCode}</Td>
                  <Td className="font-mono text-sm font-black">
                    {b.clientCode}-{b.letterCode}
                  </Td>
                  <Td>{b.productName}</Td>
                  <Td className="text-right">
                    <Badge className={bucketBadge[ageBucket(b.days)]}>
                      {`${b.days} ${L.dayUnit}`}
                    </Badge>
                  </Td>
                  <Td>
                    {b.flag ? (
                      <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                        {b.flag}
                      </Badge>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </Td>
                </TRow>
              ))
            )}
          </tbody>
        </TableWrap>
      )}
    </div>
  );
}
