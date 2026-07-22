// Qayta upakovka servisi: tahta yashik yaratish, karobkalarni scan bilan solish,
// yashikni yopish, ro'yxat/tafsilot. Har amal cargo.move huquqini talab qiladi.
import { and, asc, desc, eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  pallets,
  cargoBoxes,
  cargoLines,
  cargos,
  clients,
  warehouses,
} from "@/db/schema";
import { requirePermission } from "@/modules/shared/auth";
import { nextNumber } from "@/modules/shared/numbering";
import { RESTING_STATUSES } from "@/modules/stock/dto";
import {
  createPalletSchema,
  type CreatePalletInput,
  type PackResult,
} from "./dto";

/** Forma uchun: mijozlar + (scoped) omborlar. */
export async function getRepackFormData() {
  const session = await requirePermission("cargo.move");
  const [clientList, warehouseList] = await Promise.all([
    db.query.clients.findMany({
      where: eq(clients.isActive, true),
      orderBy: clients.code,
      columns: { id: true, code: true, name: true },
    }),
    db.query.warehouses.findMany({
      where: session.warehouseId
        ? eq(warehouses.id, session.warehouseId)
        : eq(warehouses.isActive, true),
      orderBy: warehouses.gsCode,
      columns: { id: true, code: true, gsCode: true, name: true },
    }),
  ]);
  return {
    clients: clientList,
    warehouses: warehouseList,
    fixedWarehouseId: session.warehouseId ?? null,
  };
}

/** Yangi tahta yashik yaratish (open holatda). */
export async function createPallet(input: CreatePalletInput) {
  const session = await requirePermission("cargo.move");
  const data = createPalletSchema.parse(input);

  const warehouseId = session.warehouseId || data.warehouseId;
  if (!warehouseId) throw new Error("WAREHOUSE_REQUIRED");

  const [wh, client] = await Promise.all([
    db.query.warehouses.findFirst({ where: eq(warehouses.id, warehouseId) }),
    db.query.clients.findFirst({ where: eq(clients.id, data.clientId) }),
  ]);
  if (!wh || !wh.isActive) throw new Error("WAREHOUSE_NOT_FOUND");
  if (!client || !client.isActive) throw new Error("CLIENT_NOT_FOUND");

  const code = await nextNumber("pallet", { year: true, pad: 4 });
  const [pallet] = await db
    .insert(pallets)
    .values({
      code,
      warehouseId,
      clientId: data.clientId,
      note: data.note || null,
      createdBy: session.sub,
    })
    .returning();
  return pallet;
}

/** Yashiklar ro'yxati (scoped): mijoz, ombor, karobka soni. */
export async function listPallets(filter: { status?: string } = {}) {
  const session = await requirePermission("cargo.move");
  const conds = [];
  if (session.warehouseId)
    conds.push(eq(pallets.warehouseId, session.warehouseId));
  if (filter.status) conds.push(eq(pallets.status, filter.status));

  const rows = await db
    .select({
      id: pallets.id,
      code: pallets.code,
      status: pallets.status,
      note: pallets.note,
      createdAt: pallets.createdAt,
      clientCode: clients.code,
      clientName: clients.name,
      warehouseGsCode: warehouses.gsCode,
      warehouseName: warehouses.name,
      boxCount: sql<number>`count(${cargoBoxes.id})::int`,
    })
    .from(pallets)
    .innerJoin(clients, eq(pallets.clientId, clients.id))
    .innerJoin(warehouses, eq(pallets.warehouseId, warehouses.id))
    .leftJoin(cargoBoxes, eq(cargoBoxes.palletId, pallets.id))
    .where(conds.length ? and(...conds) : undefined)
    .groupBy(
      pallets.id,
      clients.code,
      clients.name,
      warehouses.gsCode,
      warehouses.name,
    )
    .orderBy(desc(pallets.createdAt))
    .limit(200);
  return rows;
}

export type PalletBox = {
  id: string;
  qrCode: string;
  cargoId: string;
  regNumber: string;
  letterCode: string;
  productName: string;
  weightKg: number;
  volumeM3: number;
};

/** Yashik tafsiloti: ichidagi karobkalar + jami (og'irlik/hajm karobkaga bo'linadi). */
export async function getPallet(id: string) {
  const session = await requirePermission("cargo.move");
  const p = await db
    .select({
      pallet: pallets,
      clientCode: clients.code,
      clientName: clients.name,
      warehouseGsCode: warehouses.gsCode,
      warehouseName: warehouses.name,
    })
    .from(pallets)
    .innerJoin(clients, eq(pallets.clientId, clients.id))
    .innerJoin(warehouses, eq(pallets.warehouseId, warehouses.id))
    .where(eq(pallets.id, id))
    .limit(1);
  const row = p[0];
  if (!row) return null;
  if (session.warehouseId && row.pallet.warehouseId !== session.warehouseId)
    return null;

  const boxRows = await db
    .select({
      id: cargoBoxes.id,
      qrCode: cargoBoxes.qrCode,
      cargoId: cargoBoxes.cargoId,
      regNumber: cargos.regNumber,
      letterCode: cargoLines.letterCode,
      productName: cargoLines.productName,
      lineWeight: cargoLines.totalWeightKg,
      lineVolume: cargoLines.totalVolumeM3,
      lineBoxCount: cargoLines.boxCount,
    })
    .from(cargoBoxes)
    .innerJoin(cargos, eq(cargoBoxes.cargoId, cargos.id))
    .innerJoin(cargoLines, eq(cargoBoxes.lineId, cargoLines.id))
    .where(eq(cargoBoxes.palletId, id))
    .orderBy(asc(cargoLines.letterCode), asc(cargoBoxes.boxNo));

  const boxes: PalletBox[] = boxRows.map((b) => {
    const n = b.lineBoxCount || 1;
    return {
      id: b.id,
      qrCode: b.qrCode,
      cargoId: b.cargoId,
      regNumber: b.regNumber,
      letterCode: b.letterCode,
      productName: b.productName,
      weightKg: Number(b.lineWeight) / n,
      volumeM3: Number(b.lineVolume) / n,
    };
  });
  const totals = boxes.reduce(
    (a, b) => ({
      count: a.count + 1,
      weightKg: a.weightKg + b.weightKg,
      volumeM3: a.volumeM3 + b.volumeM3,
    }),
    { count: 0, weightKg: 0, volumeM3: 0 },
  );

  return {
    ...row,
    boxes,
    totals: {
      count: totals.count,
      weightKg: Math.round(totals.weightKg * 1000) / 1000,
      volumeM3: Math.round(totals.volumeM3 * 10000) / 10000,
    },
  };
}

/** Karobkani QR bo'yicha yashikga solish (scan-to-pack). */
export async function packBox(palletId: string, qrCode: string): Promise<PackResult> {
  const session = await requirePermission("cargo.move");
  const code = qrCode.trim();

  const pallet = await db.query.pallets.findFirst({
    where: eq(pallets.id, palletId),
  });
  if (!pallet) throw new Error("NOT_FOUND");
  if (session.warehouseId && pallet.warehouseId !== session.warehouseId)
    throw new Error("NOT_FOUND");
  if (pallet.status !== "open") return { outcome: "pallet_closed", code };

  const rows = await db
    .select({
      boxId: cargoBoxes.id,
      palletId: cargoBoxes.palletId,
      letterCode: cargoLines.letterCode,
      productName: cargoLines.productName,
      cargoClient: cargos.clientId,
      cargoWh: cargos.currentWarehouseId,
      cargoStatus: cargos.status,
    })
    .from(cargoBoxes)
    .innerJoin(cargos, eq(cargoBoxes.cargoId, cargos.id))
    .innerJoin(cargoLines, eq(cargoBoxes.lineId, cargoLines.id))
    // Skaner MATN QR yoki QISQA RAQAMLI ID (box_uid) — ikkalasini ham qidiramiz.
    .where(
      /^\d+$/.test(code) && Number.isSafeInteger(Number(code))
        ? or(eq(cargoBoxes.qrCode, code), eq(cargoBoxes.boxUid, Number(code)))
        : eq(cargoBoxes.qrCode, code),
    )
    .limit(1);
  const box = rows[0];
  if (!box) return { outcome: "unknown", code };

  // Karobka shu omborda va "yotgan" holatda bo'lishi shart.
  const resting = (RESTING_STATUSES as readonly string[]).includes(
    box.cargoStatus,
  );
  if (box.cargoWh !== pallet.warehouseId || !resting)
    return { outcome: "not_here", code };
  if (box.cargoClient !== pallet.clientId)
    return { outcome: "wrong_client", code };
  if (box.palletId === palletId) {
    const count = await boxCount(palletId);
    return { outcome: "already_here", code, count };
  }

  await db
    .update(cargoBoxes)
    .set({ palletId })
    .where(eq(cargoBoxes.id, box.boxId));

  const count = await boxCount(palletId);
  return {
    outcome: box.palletId ? "moved" : "packed",
    code,
    label: `${box.letterCode} · ${box.productName}`,
    count,
  };
}

/** Karobkani yashikdan chiqarish. */
export async function unpackBox(palletId: string, boxId: string) {
  const session = await requirePermission("cargo.move");
  const pallet = await db.query.pallets.findFirst({
    where: eq(pallets.id, palletId),
  });
  if (!pallet) throw new Error("NOT_FOUND");
  if (session.warehouseId && pallet.warehouseId !== session.warehouseId)
    throw new Error("NOT_FOUND");
  await db
    .update(cargoBoxes)
    .set({ palletId: null })
    .where(and(eq(cargoBoxes.id, boxId), eq(cargoBoxes.palletId, palletId)));
}

/** Yashikni yopish/qayta ochish. Yopish uchun kamida 1 karobka bo'lishi shart. */
export async function setPalletStatus(palletId: string, status: "open" | "closed") {
  const session = await requirePermission("cargo.move");
  const pallet = await db.query.pallets.findFirst({
    where: eq(pallets.id, palletId),
  });
  if (!pallet) throw new Error("NOT_FOUND");
  if (session.warehouseId && pallet.warehouseId !== session.warehouseId)
    throw new Error("NOT_FOUND");
  if (status === "closed" && (await boxCount(palletId)) === 0)
    throw new Error("PALLET_EMPTY");
  await db
    .update(pallets)
    .set({ status, closedAt: status === "closed" ? new Date() : null })
    .where(eq(pallets.id, palletId));
}

/** Bo'sh yashikni o'chirish. */
export async function deletePallet(palletId: string) {
  const session = await requirePermission("cargo.move");
  const pallet = await db.query.pallets.findFirst({
    where: eq(pallets.id, palletId),
  });
  if (!pallet) throw new Error("NOT_FOUND");
  if (session.warehouseId && pallet.warehouseId !== session.warehouseId)
    throw new Error("NOT_FOUND");
  if ((await boxCount(palletId)) > 0) throw new Error("PALLET_NOT_EMPTY");
  await db.delete(pallets).where(eq(pallets.id, palletId));
}

async function boxCount(palletId: string): Promise<number> {
  const r = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(cargoBoxes)
    .where(eq(cargoBoxes.palletId, palletId));
  return r[0]?.n ?? 0;
}

// ─── TMS integratsiyasi uchun: yashik ichidagi karobka QR'lari ──────────────

/** Yashik kodi bo'yicha ichidagi karobka ID'lari (yuklashda birga scan). */
export async function palletBoxIds(code: string): Promise<{
  palletId: string;
  boxIds: string[];
} | null> {
  const pallet = await db.query.pallets.findFirst({
    where: eq(pallets.code, code.trim()),
  });
  if (!pallet) return null;
  const rows = await db
    .select({ id: cargoBoxes.id })
    .from(cargoBoxes)
    .where(eq(cargoBoxes.palletId, pallet.id));
  return { palletId: pallet.id, boxIds: rows.map((r) => r.id) };
}
