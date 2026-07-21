// Xarajatlar va partiya foydasi (egasining asosiy hisoboti).
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  expenses,
  invoices,
  invoiceLines,
  batches,
  batchCargos,
  carriers,
  warehouses,
  cargos,
  auditLog,
} from "@/db/schema";
import { requirePermission } from "@/modules/shared/auth";
import { toUsd, fxToUsd } from "./fx";
import { getActiveTariff } from "./service";
import { expenseSchema, type ExpenseInput } from "./dto";

const r2 = (n: number) => Math.round(n * 100) / 100;

// ─── Xarajatlar ──────────────────────────────────────────────────────────────

export async function createExpense(input: ExpenseInput) {
  const session = await requirePermission("finance.manage");
  const data = expenseSchema.parse(input);
  const on = new Date(data.spentAt);
  const { amountUsd, fxRateToUsd } = await toUsd(data.amount, data.currency, on);

  const [row] = await db
    .insert(expenses)
    .values({
      category: data.category,
      amount: String(data.amount),
      currency: data.currency,
      fxRateToUsd: String(fxRateToUsd),
      amountUsd: String(amountUsd),
      batchId: data.batchId || null,
      warehouseId: data.warehouseId || null,
      carrierId: data.carrierId || null,
      spentAt: data.spentAt,
      note: data.note || null,
      createdBy: session.sub,
    })
    .returning();

  await db.insert(auditLog).values({
    userId: session.sub,
    action: "create",
    entity: "expense",
    entityId: row.id,
    payload: { category: data.category, amount: data.amount, currency: data.currency, amountUsd },
  });
  return row;
}

export async function listExpenses() {
  await requirePermission("finance.view");
  const rows = await db
    .select({
      id: expenses.id,
      category: expenses.category,
      amount: expenses.amount,
      currency: expenses.currency,
      amountUsd: expenses.amountUsd,
      spentAt: expenses.spentAt,
      note: expenses.note,
      batchCode: batches.code,
      warehouseCode: warehouses.code,
      carrierName: carriers.name,
    })
    .from(expenses)
    .leftJoin(batches, eq(expenses.batchId, batches.id))
    .leftJoin(warehouses, eq(expenses.warehouseId, warehouses.id))
    .leftJoin(carriers, eq(expenses.carrierId, carriers.id))
    .orderBy(desc(expenses.spentAt))
    .limit(300);

  const byCat = new Map<string, number>();
  let totalUsd = 0;
  for (const r of rows) {
    const u = Number(r.amountUsd);
    byCat.set(r.category, (byCat.get(r.category) ?? 0) + u);
    totalUsd += u;
  }
  return { rows, byCategory: byCat, totalUsd: r2(totalUsd) };
}

export async function getExpenseFormData() {
  await requirePermission("finance.manage");
  const [batchList, whList, carrierList] = await Promise.all([
    db
      .select({ id: batches.id, code: batches.code })
      .from(batches)
      .orderBy(desc(batches.createdAt))
      .limit(100),
    db
      .select({ id: warehouses.id, code: warehouses.code, name: warehouses.name })
      .from(warehouses)
      .where(eq(warehouses.isActive, true))
      .orderBy(asc(warehouses.gsCode)),
    db
      .select({ id: carriers.id, name: carriers.name })
      .from(carriers)
      .where(eq(carriers.isActive, true))
      .orderBy(asc(carriers.name)),
  ]);
  return { batches: batchList, warehouses: whList, carriers: carrierList };
}

// ─── Partiya foydasi ─────────────────────────────────────────────────────────
// Har yuk daromadi va transport xarajati uning YAKUNIY partiyasiga biriktiriladi
// (yo'lning oxirgi legi). Transport xarajati esa har legning agreedPrice'idan
// yukning hajm (m³) ulushi bo'yicha taqsimlanadi — ikki marta sanalmaydi.

async function agreedPriceUsdSafe(
  amount: string | null,
  currency: string | null,
  on: Date,
): Promise<number> {
  if (!amount || !currency) return 0;
  try {
    const rate = await fxToUsd(currency, on);
    return r2(Number(amount) * rate);
  } catch {
    return 0;
  }
}

async function cargoRevenueUsd(
  clientId: string,
  cargoId: string,
  cargo: { totalWeightKg: string; totalVolumeM3: string },
): Promise<number> {
  // Invoyslangan bo'lsa — haqiqiy summa; aks holda tarif bo'yicha baho.
  const [inv] = await db
    .select({
      amount: sql<string>`coalesce(sum(${invoiceLines.amount}), 0)`,
      currency: sql<string | null>`max(${invoices.currency})`,
    })
    .from(invoiceLines)
    .innerJoin(invoices, eq(invoiceLines.invoiceId, invoices.id))
    .where(and(eq(invoiceLines.cargoId, cargoId), ne(invoices.status, "void")));
  if (inv && Number(inv.amount) > 0 && inv.currency) {
    const rate = await fxToUsd(inv.currency).catch(() => 1);
    return r2(Number(inv.amount) * rate);
  }
  // Tarif bahosi:
  const kg = await getActiveTariff(clientId, "kg");
  const m3 = await getActiveTariff(clientId, "m3");
  const tariff = kg ?? m3;
  if (!tariff) return 0;
  const qty = tariff.unit === "kg" ? Number(cargo.totalWeightKg) : Number(cargo.totalVolumeM3);
  const rate = await fxToUsd(tariff.currency).catch(() => 1);
  return r2(qty * Number(tariff.rate) * rate);
}

export type BatchProfit = {
  batchId: string;
  code: string;
  originGs: string;
  destGs: string;
  status: string;
  revenueUsd: number;
  costUsd: number;
  marginUsd: number;
  marginPct: number | null;
};

export async function getBatchProfitability(): Promise<{
  rows: BatchProfit[];
  totals: { revenueUsd: number; costUsd: number; marginUsd: number };
}> {
  await requirePermission("finance.view");

  const batchRows = await db
    .select({
      id: batches.id,
      code: batches.code,
      status: batches.status,
      agreedPrice: batches.agreedPrice,
      currency: batches.currency,
      departedAt: batches.departedAt,
      originGs: sql<string>`(select gs_code from warehouse where id = ${batches.originWarehouseId})`,
      destGs: sql<string>`(select gs_code from warehouse where id = ${batches.destinationWarehouseId})`,
    })
    .from(batches)
    .where(ne(batches.status, "planned"));

  const links = await db
    .select({ batchId: batchCargos.batchId, cargoId: batchCargos.cargoId })
    .from(batchCargos);

  // Har partiya uchun USD narx va jami m³ + har yukning legи ro'yxati.
  const batchInfo = new Map<
    string,
    { priceUsd: number; totalM3: number; departedAt: number }
  >();
  for (const b of batchRows) {
    const priceUsd = await agreedPriceUsdSafe(b.agreedPrice, b.currency, b.departedAt ?? new Date());
    batchInfo.set(b.id, { priceUsd, totalM3: 0, departedAt: b.departedAt ? b.departedAt.getTime() : 0 });
  }

  const cargoIds = [...new Set(links.map((l) => l.cargoId))];
  const cargoRows = cargoIds.length
    ? await db
        .select({
          id: cargos.id,
          clientId: cargos.clientId,
          m3: cargos.totalVolumeM3,
          kg: cargos.totalWeightKg,
        })
        .from(cargos)
        .where(inArray(cargos.id, cargoIds))
    : [];
  const cargoMap = new Map(cargoRows.map((c) => [c.id, c]));

  // partiya totalM3 (faqat batchInfo'dagi partiyalar bo'yicha):
  const cargoLegs = new Map<string, string[]>(); // cargoId -> batchIds
  for (const l of links) {
    if (!batchInfo.has(l.batchId)) continue;
    const info = batchInfo.get(l.batchId)!;
    const cargo = cargoMap.get(l.cargoId);
    if (cargo) info.totalM3 += Number(cargo.m3);
    const arr = cargoLegs.get(l.cargoId) ?? [];
    arr.push(l.batchId);
    cargoLegs.set(l.cargoId, arr);
  }

  // Har partiyaga daromad va xarajat yig'amiz:
  const acc = new Map<string, { revenue: number; cost: number }>();
  for (const b of batchRows) acc.set(b.id, { revenue: 0, cost: 0 });

  for (const [cargoId, legIds] of cargoLegs) {
    const cargo = cargoMap.get(cargoId);
    if (!cargo) continue;
    // Yakuniy leg = eng kech jo'nagan partiya:
    let finalBatch = legIds[0];
    for (const id of legIds) {
      if (batchInfo.get(id)!.departedAt >= batchInfo.get(finalBatch)!.departedAt) finalBatch = id;
    }
    // Yukning barcha leglaridagi xarajat ulushi (hajm bo'yicha):
    let costShare = 0;
    for (const id of legIds) {
      const info = batchInfo.get(id)!;
      if (info.totalM3 > 0) costShare += info.priceUsd * (Number(cargo.m3) / info.totalM3);
    }
    const revenue = await cargoRevenueUsd(cargo.clientId, cargoId, {
      totalWeightKg: cargo.kg,
      totalVolumeM3: cargo.m3,
    });
    const a = acc.get(finalBatch)!;
    a.revenue += revenue;
    a.cost += costShare;
  }

  const rows: BatchProfit[] = batchRows
    .map((b) => {
      const a = acc.get(b.id)!;
      const revenueUsd = r2(a.revenue);
      const costUsd = r2(a.cost);
      const marginUsd = r2(revenueUsd - costUsd);
      return {
        batchId: b.id,
        code: b.code,
        originGs: b.originGs,
        destGs: b.destGs,
        status: b.status,
        revenueUsd,
        costUsd,
        marginUsd,
        marginPct: revenueUsd > 0 ? Math.round((marginUsd / revenueUsd) * 1000) / 10 : null,
      };
    })
    // Faqat daromad yoki xarajati bor partiyalar:
    .filter((r) => r.revenueUsd > 0 || r.costUsd > 0)
    .sort((a, b) => b.marginUsd - a.marginUsd);

  const totals = rows.reduce(
    (t, r) => ({
      revenueUsd: r2(t.revenueUsd + r.revenueUsd),
      costUsd: r2(t.costUsd + r.costUsd),
      marginUsd: r2(t.marginUsd + r.marginUsd),
    }),
    { revenueUsd: 0, costUsd: 0, marginUsd: 0 },
  );

  return { rows, totals };
}
