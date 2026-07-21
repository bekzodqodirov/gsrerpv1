// Ombor qoldig'i servisi.
//
// Logist "qachon mashina yollash kerak?" degan qarorni shu ekrandan oladi:
// har ombordagi jami kg/m³, mijozlar soni va eng eski yukning yoshi.
// Sklad xodimi (session.warehouseId) faqat o'z omborini ko'radi.
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { cargos, clients, warehouses } from "@/db/schema";
import { requirePermission } from "@/modules/shared/auth";
import {
  RESTING_STATUSES,
  ageBucket,
  daysSince,
  emptyBuckets,
  type Buckets,
} from "./dto";

export type WarehouseStock = {
  id: string;
  code: string;
  gsCode: string;
  name: string;
  country: string;
  city: string | null;
  kind: string;
  cargoCount: number;
  clientCount: number;
  totalBoxes: number;
  totalWeightKg: number;
  totalVolumeM3: number;
  oldestDays: number;
  buckets: Buckets;
};

export type StockTotals = {
  cargoCount: number;
  clientCount: number;
  totalBoxes: number;
  totalWeightKg: number;
  totalVolumeM3: number;
};

/** Barcha omborlar bo'yicha qoldiq xulasasi (bo'sh omborlar ham ko'rinadi). */
export async function getStockOverview(): Promise<{
  warehouses: WarehouseStock[];
  totals: StockTotals;
}> {
  const session = await requirePermission("cargo.view");
  const now = Date.now();

  // Ko'rish doirasidagi omborlar (sklad xodimiga faqat o'ziniki):
  const whConds = [eq(warehouses.isActive, true)];
  if (session.warehouseId) whConds.push(eq(warehouses.id, session.warehouseId));
  const whs = await db.query.warehouses.findMany({
    where: and(...whConds),
    orderBy: [asc(warehouses.country), asc(warehouses.gsCode)],
  });

  // Omborda yotgan yuklar:
  const cargoConds = [
    eq(cargos.voided, false),
    inArray(cargos.status, [...RESTING_STATUSES]),
    isNotNull(cargos.currentWarehouseId),
  ];
  if (session.warehouseId) {
    cargoConds.push(eq(cargos.currentWarehouseId, session.warehouseId));
  }
  const rows = await db
    .select({
      warehouseId: cargos.currentWarehouseId,
      clientId: cargos.clientId,
      boxes: cargos.totalBoxes,
      kg: cargos.totalWeightKg,
      m3: cargos.totalVolumeM3,
      receivedAt: cargos.receivedAt,
    })
    .from(cargos)
    .where(and(...cargoConds));

  type Acc = {
    boxes: number;
    kg: number;
    m3: number;
    cargoCount: number;
    clients: Set<string>;
    oldestDays: number;
    buckets: Buckets;
  };
  const byWarehouse = new Map<string, Acc>();
  const allClients = new Set<string>();
  let totalBoxes = 0;
  let totalKg = 0;
  let totalM3 = 0;

  for (const r of rows) {
    const wid = r.warehouseId!;
    const acc =
      byWarehouse.get(wid) ??
      ({
        boxes: 0,
        kg: 0,
        m3: 0,
        cargoCount: 0,
        clients: new Set<string>(),
        oldestDays: 0,
        buckets: emptyBuckets(),
      } satisfies Acc);
    const kg = Number(r.kg);
    const m3 = Number(r.m3);
    const days = daysSince(r.receivedAt, now);
    acc.boxes += r.boxes;
    acc.kg += kg;
    acc.m3 += m3;
    acc.cargoCount += 1;
    acc.clients.add(r.clientId);
    acc.oldestDays = Math.max(acc.oldestDays, days);
    acc.buckets[ageBucket(days)] += 1;
    byWarehouse.set(wid, acc);

    allClients.add(r.clientId);
    totalBoxes += r.boxes;
    totalKg += kg;
    totalM3 += m3;
  }

  const warehousesOut: WarehouseStock[] = whs.map((w) => {
    const a = byWarehouse.get(w.id);
    return {
      id: w.id,
      code: w.code,
      gsCode: w.gsCode,
      name: w.name,
      country: w.country,
      city: w.city,
      kind: w.kind,
      cargoCount: a?.cargoCount ?? 0,
      clientCount: a ? a.clients.size : 0,
      totalBoxes: a?.boxes ?? 0,
      totalWeightKg: round3(a?.kg ?? 0),
      totalVolumeM3: round4(a?.m3 ?? 0),
      oldestDays: a?.oldestDays ?? 0,
      buckets: a?.buckets ?? emptyBuckets(),
    };
  });

  return {
    warehouses: warehousesOut,
    totals: {
      cargoCount: rows.length,
      clientCount: allClients.size,
      totalBoxes,
      totalWeightKg: round3(totalKg),
      totalVolumeM3: round4(totalM3),
    },
  };
}

export type ClientStock = {
  clientId: string;
  code: string;
  name: string;
  cargoCount: number;
  totalBoxes: number;
  totalWeightKg: number;
  totalVolumeM3: number;
  oldestDays: number;
};

export type CargoStockRow = {
  cargoId: string;
  regNumber: string;
  status: string;
  clientCode: string;
  clientName: string;
  boxes: number;
  weightKg: number;
  volumeM3: number;
  receivedAt: Date;
  days: number;
};

/** Bitta ombor tafsiloti: mijozlar kesimida + yuklar ro'yxati (FIFO). */
export async function getWarehouseStock(warehouseId: string): Promise<{
  warehouse: typeof warehouses.$inferSelect;
  clients: ClientStock[];
  cargos: CargoStockRow[];
  totals: StockTotals;
} | null> {
  const session = await requirePermission("cargo.view");
  // Sklad xodimi begona omborni ko'ra olmaydi — "topilmadi" kabi (null),
  // shunda sahifa umumiy ko'rinishga qaytadi (500 emas).
  if (session.warehouseId && session.warehouseId !== warehouseId) {
    return null;
  }

  const wh = await db.query.warehouses.findFirst({
    where: eq(warehouses.id, warehouseId),
  });
  if (!wh) return null;

  const now = Date.now();
  const rows = await db
    .select({
      cargoId: cargos.id,
      regNumber: cargos.regNumber,
      status: cargos.status,
      boxes: cargos.totalBoxes,
      kg: cargos.totalWeightKg,
      m3: cargos.totalVolumeM3,
      receivedAt: cargos.receivedAt,
      clientId: clients.id,
      clientCode: clients.code,
      clientName: clients.name,
    })
    .from(cargos)
    .innerJoin(clients, eq(cargos.clientId, clients.id))
    .where(
      and(
        eq(cargos.voided, false),
        inArray(cargos.status, [...RESTING_STATUSES]),
        eq(cargos.currentWarehouseId, warehouseId),
      ),
    )
    // Eng eski birinchi — mashina yuklashda FIFO tavsiyasi shu tartibda.
    .orderBy(asc(cargos.receivedAt));

  const cargoRows: CargoStockRow[] = rows.map((r) => ({
    cargoId: r.cargoId,
    regNumber: r.regNumber,
    status: r.status,
    clientCode: r.clientCode,
    clientName: r.clientName,
    boxes: r.boxes,
    weightKg: Number(r.kg),
    volumeM3: Number(r.m3),
    receivedAt: r.receivedAt,
    days: daysSince(r.receivedAt, now),
  }));

  const byClient = new Map<string, ClientStock>();
  let totalBoxes = 0;
  let totalKg = 0;
  let totalM3 = 0;
  for (const r of cargoRows) {
    const c =
      byClient.get(r.clientCode) ??
      ({
        clientId: rows.find((x) => x.clientCode === r.clientCode)!.clientId,
        code: r.clientCode,
        name: r.clientName,
        cargoCount: 0,
        totalBoxes: 0,
        totalWeightKg: 0,
        totalVolumeM3: 0,
        oldestDays: 0,
      } satisfies ClientStock);
    c.cargoCount += 1;
    c.totalBoxes += r.boxes;
    c.totalWeightKg += r.weightKg;
    c.totalVolumeM3 += r.volumeM3;
    c.oldestDays = Math.max(c.oldestDays, r.days);
    byClient.set(r.clientCode, c);

    totalBoxes += r.boxes;
    totalKg += r.weightKg;
    totalM3 += r.volumeM3;
  }

  const clientsOut = [...byClient.values()]
    .map((c) => ({
      ...c,
      totalWeightKg: round3(c.totalWeightKg),
      totalVolumeM3: round4(c.totalVolumeM3),
    }))
    // Eng ko'p yotib qolgan mijoz tepada.
    .sort((a, b) => b.oldestDays - a.oldestDays);

  return {
    warehouse: wh,
    clients: clientsOut,
    cargos: cargoRows,
    totals: {
      cargoCount: cargoRows.length,
      clientCount: byClient.size,
      totalBoxes,
      totalWeightKg: round3(totalKg),
      totalVolumeM3: round4(totalM3),
    },
  };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
