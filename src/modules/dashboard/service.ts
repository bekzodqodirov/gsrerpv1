// Egasi paneli: barcha modullardan jamlangan KPI'lar. Rol/omborga qarab
// mos qismlar qaytariladi (sklad xodimi faqat o'z omborini + moliyasiz).
import { and, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  cargos,
  clients,
  warehouses,
  batches,
  batchCargos,
  clientLedger,
  expenses,
} from "@/db/schema";
import { getSession } from "@/modules/shared/auth";
import { RESTING_STATUSES } from "@/modules/stock/dto";
import type { CargoStatus } from "@/modules/cargo/dto";

const TRANSIT_STATUSES: readonly CargoStatus[] = [
  "in_transit_ksg",
  "loaded",
  "cn_customs",
  "in_transit_uz",
];

const n = (v: unknown) => Number(v ?? 0);
const r2 = (x: number) => Math.round(x * 100) / 100;

export async function getDashboard() {
  const session = await getSession();
  const perms = session?.perms ?? [];
  const has = (p: string) => perms.includes("*") || perms.includes(p);
  const whId = session?.warehouseId ?? null;

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // ─── Ombor qoldig'i (yotgan yuk) ───
  const stockConds = [
    eq(cargos.voided, false),
    inArray(cargos.status, [...RESTING_STATUSES]),
    isNotNull(cargos.currentWarehouseId),
  ];
  if (whId) stockConds.push(eq(cargos.currentWarehouseId, whId));

  const stockByWh = await db
    .select({
      whId: cargos.currentWarehouseId,
      gsCode: warehouses.gsCode,
      name: warehouses.name,
      boxes: sql<number>`coalesce(sum(${cargos.totalBoxes}),0)::int`,
      kg: sql<string>`coalesce(sum(${cargos.totalWeightKg}),0)`,
      m3: sql<string>`coalesce(sum(${cargos.totalVolumeM3}),0)`,
      clientCount: sql<number>`count(distinct ${cargos.clientId})::int`,
    })
    .from(cargos)
    .innerJoin(warehouses, eq(cargos.currentWarehouseId, warehouses.id))
    .where(and(...stockConds))
    .groupBy(cargos.currentWarehouseId, warehouses.gsCode, warehouses.name, warehouses.country, warehouses.gsCode);

  const stock = {
    boxes: stockByWh.reduce((s, w) => s + n(w.boxes), 0),
    kg: r2(stockByWh.reduce((s, w) => s + n(w.kg), 0)),
    m3: r2(stockByWh.reduce((s, w) => s + n(w.m3), 0)),
    warehouses: stockByWh
      .map((w) => ({ gsCode: w.gsCode, name: w.name, boxes: n(w.boxes), kg: r2(n(w.kg)), m3: r2(n(w.m3)), clientCount: n(w.clientCount) }))
      .sort((a, b) => b.m3 - a.m3),
  };

  // ─── Shu hafta kirim ───
  const intakeConds = [eq(cargos.voided, false), gte(cargos.receivedAt, weekAgo)];
  if (whId) intakeConds.push(eq(cargos.originWarehouseId, whId));
  const [intake] = await db
    .select({
      count: sql<number>`count(*)::int`,
      kg: sql<string>`coalesce(sum(${cargos.totalWeightKg}),0)`,
      m3: sql<string>`coalesce(sum(${cargos.totalVolumeM3}),0)`,
    })
    .from(cargos)
    .where(and(...intakeConds));

  // ─── Yo'ldagi yuk ───
  const transitConds = [eq(cargos.voided, false), inArray(cargos.status, [...TRANSIT_STATUSES])];
  if (whId) transitConds.push(eq(cargos.originWarehouseId, whId));
  const [transit] = await db
    .select({
      count: sql<number>`count(*)::int`,
      kg: sql<string>`coalesce(sum(${cargos.totalWeightKg}),0)`,
      m3: sql<string>`coalesce(sum(${cargos.totalVolumeM3}),0)`,
    })
    .from(cargos)
    .where(and(...transitConds));

  // ─── Eng ko'p qoldiqli mijozlar ───
  const topClients = await db
    .select({
      code: clients.code,
      name: clients.name,
      m3: sql<string>`coalesce(sum(${cargos.totalVolumeM3}),0)`,
      kg: sql<string>`coalesce(sum(${cargos.totalWeightKg}),0)`,
    })
    .from(cargos)
    .innerJoin(clients, eq(cargos.clientId, clients.id))
    .where(and(...stockConds))
    .groupBy(clients.code, clients.name)
    .orderBy(desc(sql`sum(${cargos.totalVolumeM3})`))
    .limit(5);

  // ─── Moliya (faqat finance.view) ───
  let finance:
    | { revenueUsd: number; expenseUsd: number; marginUsd: number; debtorsUsd: number; debtorCount: number }
    | null = null;
  if (has("finance.view")) {
    const [rev] = await db
      .select({ s: sql<string>`coalesce(sum(${clientLedger.amountUsd}),0)` })
      .from(clientLedger)
      .where(and(eq(clientLedger.type, "charge"), gte(clientLedger.at, monthStart)));
    const [exp] = await db
      .select({ s: sql<string>`coalesce(sum(${expenses.amountUsd}),0)` })
      .from(expenses)
      .where(gte(expenses.spentAt, monthStart.toISOString().slice(0, 10)));
    const bal = await db
      .select({ clientId: clientLedger.clientId, b: sql<string>`sum(${clientLedger.amountUsd})` })
      .from(clientLedger)
      .groupBy(clientLedger.clientId);
    const debtors = bal.filter((x) => n(x.b) > 0.01);
    const revenueUsd = r2(n(rev.s));
    const expenseUsd = r2(n(exp.s));
    finance = {
      revenueUsd,
      expenseUsd,
      marginUsd: r2(revenueUsd - expenseUsd),
      debtorsUsd: r2(debtors.reduce((s, x) => s + n(x.b), 0)),
      debtorCount: debtors.length,
    };
  }

  // ─── So'nggi partiyalar (faqat tms.view) ───
  let recentBatches:
    | { id: string; code: string; status: string; originGs: string; destGs: string; cargoCount: number }[]
    | null = null;
  if (has("tms.view")) {
    const bConds = [];
    if (whId) bConds.push(sql`(${batches.originWarehouseId} = ${whId} or ${batches.destinationWarehouseId} = ${whId})`);
    const bs = await db
      .select({
        id: batches.id,
        code: batches.code,
        status: batches.status,
        originGs: sql<string>`(select gs_code from warehouse where id = ${batches.originWarehouseId})`,
        destGs: sql<string>`(select gs_code from warehouse where id = ${batches.destinationWarehouseId})`,
        cargoCount: sql<number>`(select count(*)::int from ${batchCargos} where ${batchCargos.batchId} = ${batches.id})`,
      })
      .from(batches)
      .where(bConds.length ? and(...bConds) : undefined)
      .orderBy(desc(batches.createdAt))
      .limit(5);
    recentBatches = bs.map((b) => ({ ...b, cargoCount: n(b.cargoCount) }));
  }

  return {
    warehouseName: whId ? stockByWh.find((w) => w.whId === whId)?.name ?? null : null,
    stock,
    intake: { count: n(intake.count), kg: r2(n(intake.kg)), m3: r2(n(intake.m3)) },
    transit: { count: n(transit.count), kg: r2(n(transit.kg)), m3: r2(n(transit.m3)) },
    topClients: topClients.filter((c) => n(c.m3) > 0).map((c) => ({ code: c.code, name: c.name, m3: r2(n(c.m3)), kg: r2(n(c.kg)) })),
    finance,
    recentBatches,
  };
}
