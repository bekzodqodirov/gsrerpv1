// TMS servisi: yollanma mashinalar, partiyalar, yuklash rejasi va holat o'tishlari.
//
// Kelishilgan narx (agreedPrice) — nozik ma'lumot. Faqat tms.manage huquqiga
// ega foydalanuvchi ko'radi; sklad xodimiga hech qachon qaytarilmaydi.
import { and, asc, count, desc, eq, inArray, ne, notInArray, or } from "drizzle-orm";
import { db } from "@/db";
import {
  carriers,
  batches,
  batchCargos,
  batchBoxes,
  cargos,
  cargoBoxes,
  cargoLines,
  cargoEvents,
  clients,
  warehouses,
  auditLog,
  docSequences,
} from "@/db/schema";
import type { ScanResult } from "./dto";
import { getSession, requirePermission } from "@/modules/shared/auth";
import type { SessionPayload } from "@/modules/shared/session";
import { nextNumber } from "@/modules/shared/numbering";
import {
  carrierSchema,
  batchCreateSchema,
  legStatuses,
  sourceStatusForOrigin,
  type CarrierInput,
  type BatchCreateInput,
} from "./dto";

// ─── Huquq yordamchilari ─────────────────────────────────────────────────────

function canSeePrice(session: SessionPayload): boolean {
  return session.perms.includes("*") || session.perms.includes("tms.manage");
}

/** Berilgan huquqlardan birortasi bo'lsa — o'tadi (yuklash: sklad yoki logist). */
async function requireAny(codes: string[]): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  if (
    session.perms.includes("*") ||
    codes.some((c) => session.perms.includes(c))
  ) {
    return session;
  }
  throw new Error(`FORBIDDEN: ${codes.join("|")}`);
}

// ─── Carriers ────────────────────────────────────────────────────────────────

export async function listCarriers() {
  await requirePermission("tms.view");
  return db.query.carriers.findMany({ orderBy: [desc(carriers.isActive), asc(carriers.name)] });
}

export async function createCarrier(input: CarrierInput) {
  const session = await requirePermission("tms.manage");
  const data = carrierSchema.parse(input);
  const [c] = await db
    .insert(carriers)
    .values({
      name: data.name,
      phone: data.phone || null,
      truckPlate: data.truckPlate || null,
      truckType: data.truckType || null,
      capacityKg: data.capacityKg != null ? String(data.capacityKg) : null,
      capacityM3: data.capacityM3 != null ? String(data.capacityM3) : null,
      note: data.note || null,
    })
    .returning();
  await db.insert(auditLog).values({
    userId: session.sub,
    action: "create",
    entity: "carrier",
    entityId: c.id,
    payload: { name: c.name },
  });
  return c;
}

export async function setCarrierActive(id: string, isActive: boolean) {
  const session = await requirePermission("tms.manage");
  await db.update(carriers).set({ isActive }).where(eq(carriers.id, id));
  await db.insert(auditLog).values({
    userId: session.sub,
    action: "update",
    entity: "carrier",
    entityId: id,
    payload: { isActive },
  });
}

// ─── Batch code raqamlash (origin ombor bo'yicha: YW_001, KA_001...) ──────────

const BATCH_PREFIX: Record<string, string> = {
  YIWU: "YW",
  GZ: "GZ",
  URC: "UR",
  KSG: "KA",
  TAS: "TS",
  AND: "AN",
};
function batchPrefix(warehouseCode: string): string {
  return BATCH_PREFIX[warehouseCode] ?? warehouseCode.slice(0, 2).toUpperCase();
}

async function nextBatchCode(originCode: string): Promise<string> {
  const docType = `batch_${originCode}`;
  // Ketma-ketlik yo'q bo'lsa — yaratamiz (yangi ombor uchun ham ishlaydi).
  await db
    .insert(docSequences)
    .values({ docType, prefix: batchPrefix(originCode), lastNumber: "0" })
    .onConflictDoNothing();
  return nextNumber(docType, { separator: "_", pad: 3 });
}

// ─── Batch CRUD ──────────────────────────────────────────────────────────────

export async function createBatch(input: BatchCreateInput) {
  const session = await requirePermission("tms.manage");
  const data = batchCreateSchema.parse(input);
  if (data.originWarehouseId === data.destinationWarehouseId) {
    throw new Error("SAME_WAREHOUSE");
  }
  const origin = await db.query.warehouses.findFirst({
    where: eq(warehouses.id, data.originWarehouseId),
  });
  const dest = await db.query.warehouses.findFirst({
    where: eq(warehouses.id, data.destinationWarehouseId),
  });
  if (!origin || !dest) throw new Error("WAREHOUSE_NOT_FOUND");

  const code = await nextBatchCode(origin.code);
  const [b] = await db
    .insert(batches)
    .values({
      code,
      originWarehouseId: origin.id,
      destinationWarehouseId: dest.id,
      carrierId: data.carrierId || null,
      agreedPrice: data.agreedPrice != null ? String(data.agreedPrice) : null,
      currency: data.currency || null,
      sealNumber: data.sealNumber || null,
      note: data.note || null,
      createdBy: session.sub,
    })
    .returning();

  await db.insert(auditLog).values({
    userId: session.sub,
    action: "create",
    entity: "batch",
    entityId: b.id,
    payload: { code, origin: origin.code, dest: dest.code },
  });
  return b;
}

/** Partiyalar ro'yxati. Sklad xodimiga faqat o'z omboriga tegishlilari. */
export async function listBatches() {
  const session = await requirePermission("tms.view");
  const conds = [];
  if (session.warehouseId) {
    conds.push(
      or(
        eq(batches.originWarehouseId, session.warehouseId),
        eq(batches.destinationWarehouseId, session.warehouseId),
      )!,
    );
  }
  const rows = await db
    .select({
      id: batches.id,
      code: batches.code,
      status: batches.status,
      plannedAt: batches.plannedAt,
      departedAt: batches.departedAt,
      originCode: warehouses.code,
      originGs: warehouses.gsCode,
      agreedPrice: batches.agreedPrice,
      currency: batches.currency,
    })
    .from(batches)
    .innerJoin(warehouses, eq(batches.originWarehouseId, warehouses.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(batches.createdAt))
    .limit(200);

  // Manzil ombor kodi + yuk/kg/m3 jamlari + narxni filtrlash:
  const ids = rows.map((r) => r.id);
  const destRows = ids.length
    ? await db
        .select({
          batchId: batches.id,
          destCode: warehouses.code,
          destGs: warehouses.gsCode,
        })
        .from(batches)
        .innerJoin(warehouses, eq(batches.destinationWarehouseId, warehouses.id))
        .where(inArray(batches.id, ids))
    : [];
  const destMap = new Map(destRows.map((d) => [d.batchId, d]));

  const totalRows = ids.length
    ? await db
        .select({
          batchId: batchCargos.batchId,
          boxes: cargos.totalBoxes,
          kg: cargos.totalWeightKg,
          m3: cargos.totalVolumeM3,
        })
        .from(batchCargos)
        .innerJoin(cargos, eq(batchCargos.cargoId, cargos.id))
        .where(inArray(batchCargos.batchId, ids))
    : [];
  const totalsMap = new Map<
    string,
    { cargoCount: number; boxes: number; kg: number; m3: number }
  >();
  for (const r of totalRows) {
    const acc = totalsMap.get(r.batchId) ?? { cargoCount: 0, boxes: 0, kg: 0, m3: 0 };
    acc.cargoCount += 1;
    acc.boxes += r.boxes;
    acc.kg += Number(r.kg);
    acc.m3 += Number(r.m3);
    totalsMap.set(r.batchId, acc);
  }

  const showPrice = canSeePrice(session);
  return rows.map((r) => {
    const t = totalsMap.get(r.id) ?? { cargoCount: 0, boxes: 0, kg: 0, m3: 0 };
    const dest = destMap.get(r.id);
    return {
      id: r.id,
      code: r.code,
      status: r.status,
      plannedAt: r.plannedAt,
      departedAt: r.departedAt,
      originGs: r.originGs,
      originCode: r.originCode,
      destGs: dest?.destGs ?? "",
      destCode: dest?.destCode ?? "",
      cargoCount: t.cargoCount,
      totalBoxes: t.boxes,
      totalWeightKg: Math.round(t.kg * 1000) / 1000,
      totalVolumeM3: Math.round(t.m3 * 10000) / 10000,
      agreedPrice: showPrice ? r.agreedPrice : null,
      currency: showPrice ? r.currency : null,
    };
  });
}

/** Partiya tafsiloti: tarkibidagi yuklar (manifest) + jamlar + (narx). */
export async function getBatch(id: string) {
  const session = await requirePermission("tms.view");

  const b = await db.query.batches.findFirst({ where: eq(batches.id, id) });
  if (!b) return null;
  if (
    session.warehouseId &&
    b.originWarehouseId !== session.warehouseId &&
    b.destinationWarehouseId !== session.warehouseId
  ) {
    return null;
  }

  const [origin, dest, carrier] = await Promise.all([
    db.query.warehouses.findFirst({ where: eq(warehouses.id, b.originWarehouseId) }),
    db.query.warehouses.findFirst({ where: eq(warehouses.id, b.destinationWarehouseId) }),
    b.carrierId
      ? db.query.carriers.findFirst({ where: eq(carriers.id, b.carrierId) })
      : Promise.resolve(null),
  ]);

  const items = await db
    .select({
      cargoId: cargos.id,
      regNumber: cargos.regNumber,
      status: cargos.status,
      boxes: cargos.totalBoxes,
      kg: cargos.totalWeightKg,
      m3: cargos.totalVolumeM3,
      scanned: batchCargos.scanned,
      clientCode: clients.code,
      clientName: clients.name,
    })
    .from(batchCargos)
    .innerJoin(cargos, eq(batchCargos.cargoId, cargos.id))
    .innerJoin(clients, eq(cargos.clientId, clients.id))
    .where(eq(batchCargos.batchId, id))
    .orderBy(asc(clients.code));

  const totals = items.reduce(
    (t, i) => ({
      cargoCount: t.cargoCount + 1,
      boxes: t.boxes + i.boxes,
      kg: t.kg + Number(i.kg),
      m3: t.m3 + Number(i.m3),
    }),
    { cargoCount: 0, boxes: 0, kg: 0, m3: 0 },
  );

  // Karobka scan holati (yuklandi/tushirildi/yetishmadi) — yuk bo'yicha va jami.
  const bbRows = await db
    .select({
      cargoId: batchBoxes.cargoId,
      loaded: batchBoxes.loadedScan,
      unloaded: batchBoxes.unloadedScan,
      flag: batchBoxes.flag,
    })
    .from(batchBoxes)
    .where(eq(batchBoxes.batchId, id));
  const scanByCargo = new Map<
    string,
    { total: number; loaded: number; unloaded: number; missing: number }
  >();
  let loadDone = 0;
  let unloadDone = 0;
  let missingTotal = 0;
  for (const r of bbRows) {
    const s = scanByCargo.get(r.cargoId) ?? { total: 0, loaded: 0, unloaded: 0, missing: 0 };
    s.total += 1;
    if (r.loaded) {
      s.loaded += 1;
      loadDone += 1;
    }
    if (r.unloaded) {
      s.unloaded += 1;
      unloadDone += 1;
    }
    if (r.flag === "missing") {
      s.missing += 1;
      missingTotal += 1;
    }
    scanByCargo.set(r.cargoId, s);
  }
  const boxTotal = bbRows.length;

  const showPrice = canSeePrice(session);
  return {
    batch: {
      id: b.id,
      code: b.code,
      status: b.status,
      sealNumber: b.sealNumber,
      note: b.note,
      plannedAt: b.plannedAt,
      departedAt: b.departedAt,
      arrivedAt: b.arrivedAt,
      unloadedAt: b.unloadedAt,
      agreedPrice: showPrice ? b.agreedPrice : null,
      currency: showPrice ? b.currency : null,
    },
    origin: origin ? { id: origin.id, code: origin.code, gsCode: origin.gsCode, name: origin.name, kind: origin.kind } : null,
    dest: dest ? { id: dest.id, code: dest.code, gsCode: dest.gsCode, name: dest.name, country: dest.country, kind: dest.kind } : null,
    carrier: carrier
      ? {
          id: carrier.id,
          name: carrier.name,
          phone: carrier.phone,
          truckPlate: carrier.truckPlate,
          capacityKg: carrier.capacityKg,
          capacityM3: carrier.capacityM3,
        }
      : null,
    items: items.map((i) => ({
      ...i,
      kg: Number(i.kg),
      m3: Number(i.m3),
      scan: scanByCargo.get(i.cargoId) ?? {
        total: i.boxes,
        loaded: 0,
        unloaded: 0,
        missing: 0,
      },
    })),
    totals: {
      cargoCount: totals.cargoCount,
      totalBoxes: totals.boxes,
      totalWeightKg: Math.round(totals.kg * 1000) / 1000,
      totalVolumeM3: Math.round(totals.m3 * 10000) / 10000,
    },
    loadProgress: { done: loadDone, total: boxTotal },
    unloadProgress: { done: unloadDone, total: boxTotal },
    missingCount: missingTotal,
    canManage: session.perms.includes("*") || session.perms.includes("tms.manage"),
    canLoad:
      session.perms.includes("*") ||
      session.perms.includes("tms.load") ||
      session.perms.includes("tms.manage"),
  };
}

/** Origin ombordagi, hali ochiq partiyaga tegmagan, tayyor yuklar. */
export async function getAvailableCargos(batchId: string) {
  await requirePermission("tms.view");
  const b = await db.query.batches.findFirst({ where: eq(batches.id, batchId) });
  if (!b) return [];
  const origin = await db.query.warehouses.findFirst({
    where: eq(warehouses.id, b.originWarehouseId),
  });
  if (!origin) return [];
  const sourceStatus = sourceStatusForOrigin(origin.kind);

  // Ochiq (yopilmagan) partiyalardagi yuklar — ular band:
  const busy = await db
    .select({ cargoId: batchCargos.cargoId })
    .from(batchCargos)
    .innerJoin(batches, eq(batchCargos.batchId, batches.id))
    .where(ne(batches.status, "closed"));
  const busyIds = busy.map((x) => x.cargoId);

  const conds = [
    eq(cargos.voided, false),
    eq(cargos.status, sourceStatus),
    eq(cargos.currentWarehouseId, b.originWarehouseId),
  ];
  if (busyIds.length) conds.push(notInArray(cargos.id, busyIds));

  return db
    .select({
      cargoId: cargos.id,
      regNumber: cargos.regNumber,
      boxes: cargos.totalBoxes,
      kg: cargos.totalWeightKg,
      m3: cargos.totalVolumeM3,
      receivedAt: cargos.receivedAt,
      clientCode: clients.code,
      clientName: clients.name,
    })
    .from(cargos)
    .innerJoin(clients, eq(cargos.clientId, clients.id))
    .where(and(...conds))
    .orderBy(asc(cargos.receivedAt)); // FIFO
}

// ─── Yuklash rejasi (add/remove) ─────────────────────────────────────────────

async function assertPlannable(batchId: string) {
  const b = await db.query.batches.findFirst({ where: eq(batches.id, batchId) });
  if (!b) throw new Error("NOT_FOUND");
  if (b.status !== "planned" && b.status !== "loading") {
    throw new Error("BATCH_LOCKED"); // jo'nagandan keyin tarkib o'zgarmaydi
  }
  return b;
}

export async function addCargoToBatch(batchId: string, cargoId: string) {
  await requireAny(["tms.manage", "tms.load"]);
  const b = await assertPlannable(batchId);
  const cargo = await db.query.cargos.findFirst({ where: eq(cargos.id, cargoId) });
  if (!cargo) throw new Error("CARGO_NOT_FOUND");
  if (cargo.currentWarehouseId !== b.originWarehouseId) {
    throw new Error("CARGO_NOT_AT_ORIGIN");
  }
  await db.transaction(async (tx) => {
    await tx
      .insert(batchCargos)
      .values({ batchId, cargoId })
      .onConflictDoNothing();
    // Kutilayotgan manifest: shu yukning har bir karobkasi uchun bitta qator.
    const boxes = await tx
      .select({ id: cargoBoxes.id })
      .from(cargoBoxes)
      .where(eq(cargoBoxes.cargoId, cargoId));
    if (boxes.length) {
      await tx
        .insert(batchBoxes)
        .values(boxes.map((bx) => ({ batchId, boxId: bx.id, cargoId })))
        .onConflictDoNothing();
    }
  });
}

export async function removeCargoFromBatch(batchId: string, cargoId: string) {
  await requireAny(["tms.manage", "tms.load"]);
  await assertPlannable(batchId);
  await db.transaction(async (tx) => {
    await tx
      .delete(batchBoxes)
      .where(and(eq(batchBoxes.batchId, batchId), eq(batchBoxes.cargoId, cargoId)));
    await tx
      .delete(batchCargos)
      .where(and(eq(batchCargos.batchId, batchId), eq(batchCargos.cargoId, cargoId)));
  });
}

// ─── Scan: yuklash (chiqish) va tushirish (qabul) ────────────────────────────

/** Bitta karobka etiketkasidan olingan "human" yorlig'i. */
async function boxLabel(boxId: string, done: number, total: number) {
  const row = await db
    .select({
      product: cargoLines.productName,
      clientCode: clients.code,
    })
    .from(cargoBoxes)
    .innerJoin(cargoLines, eq(cargoBoxes.lineId, cargoLines.id))
    .innerJoin(cargos, eq(cargoBoxes.cargoId, cargos.id))
    .innerJoin(clients, eq(cargos.clientId, clients.id))
    .where(eq(cargoBoxes.id, boxId))
    .limit(1);
  const r = row[0];
  return r ? `${r.clientCode} · ${r.product} · ${done}/${total}` : undefined;
}

async function loadProgress(batchId: string) {
  const [tot] = await db
    .select({ total: count() })
    .from(batchBoxes)
    .where(eq(batchBoxes.batchId, batchId));
  const [ld] = await db
    .select({ done: count() })
    .from(batchBoxes)
    .where(and(eq(batchBoxes.batchId, batchId), eq(batchBoxes.loadedScan, true)));
  return { done: ld.done, total: tot.total };
}

async function unloadProgress(batchId: string) {
  const [tot] = await db
    .select({ total: count() })
    .from(batchBoxes)
    .where(eq(batchBoxes.batchId, batchId));
  const [ul] = await db
    .select({ done: count() })
    .from(batchBoxes)
    .where(and(eq(batchBoxes.batchId, batchId), eq(batchBoxes.unloadedScan, true)));
  return { done: ul.done, total: tot.total };
}

/** Yuklash scani: karobka QR kodini scan qiladi (kamera/skaner/qo'lda). */
export async function scanLoad(batchId: string, code: string): Promise<ScanResult> {
  const session = await requireAny(["tms.manage", "tms.load"]);
  const b = await db.query.batches.findFirst({ where: eq(batches.id, batchId) });
  if (!b) throw new Error("NOT_FOUND");
  assertWarehouseScope(session, b.originWarehouseId);
  if (b.status !== "planned" && b.status !== "loading") {
    return { outcome: "wrong_status", code };
  }

  // Shu partiya manifestidagi karobkani QR bo'yicha topamiz:
  const rows = await db
    .select({ bbId: batchBoxes.id, boxId: batchBoxes.boxId, loaded: batchBoxes.loadedScan })
    .from(batchBoxes)
    .innerJoin(cargoBoxes, eq(batchBoxes.boxId, cargoBoxes.id))
    .where(and(eq(batchBoxes.batchId, batchId), eq(cargoBoxes.qrCode, code)))
    .limit(1);
  const hit = rows[0];

  if (!hit) {
    const known = await db.query.cargoBoxes.findFirst({ where: eq(cargoBoxes.qrCode, code) });
    return { outcome: known ? "not_on_plan" : "unknown", code };
  }
  if (hit.loaded) {
    const p = await loadProgress(batchId);
    return { outcome: "duplicate", code, done: p.done, total: p.total };
  }

  await db
    .update(batchBoxes)
    .set({ loadedScan: true, loadedAt: new Date(), loadedBy: session.sub, flag: null })
    .where(eq(batchBoxes.id, hit.bbId));
  if (b.status === "planned") {
    await db.update(batches).set({ status: "loading", updatedAt: new Date() }).where(eq(batches.id, batchId));
  }

  const p = await loadProgress(batchId);
  return { outcome: "loaded", code, done: p.done, total: p.total, label: await boxLabel(hit.boxId, p.done, p.total) };
}

/** Tushirish scani: manzilda karobkani scan qiladi (manifestga taqqoslaydi). */
export async function scanUnload(batchId: string, code: string): Promise<ScanResult> {
  const session = await requireAny(["tms.manage", "tms.load"]);
  const b = await db.query.batches.findFirst({ where: eq(batches.id, batchId) });
  if (!b) throw new Error("NOT_FOUND");
  assertWarehouseScope(session, b.destinationWarehouseId);
  if (b.status !== "departed" && b.status !== "arrived") {
    return { outcome: "wrong_status", code };
  }

  const rows = await db
    .select({ bbId: batchBoxes.id, boxId: batchBoxes.boxId, unloaded: batchBoxes.unloadedScan })
    .from(batchBoxes)
    .innerJoin(cargoBoxes, eq(batchBoxes.boxId, cargoBoxes.id))
    .where(and(eq(batchBoxes.batchId, batchId), eq(cargoBoxes.qrCode, code)))
    .limit(1);
  const hit = rows[0];

  if (!hit) {
    // Manifestda yo'q: ortiqcha (boshqa partiya karobkasi) yoki noma'lum.
    const known = await db.query.cargoBoxes.findFirst({ where: eq(cargoBoxes.qrCode, code) });
    return { outcome: known ? "extra" : "unknown", code };
  }
  if (hit.unloaded) {
    const p = await unloadProgress(batchId);
    return { outcome: "duplicate", code, done: p.done, total: p.total };
  }

  await db
    .update(batchBoxes)
    .set({ unloadedScan: true, unloadedAt: new Date(), unloadedBy: session.sub, flag: null })
    .where(eq(batchBoxes.id, hit.bbId));

  const p = await unloadProgress(batchId);
  return { outcome: "unloaded", code, done: p.done, total: p.total, label: await boxLabel(hit.boxId, p.done, p.total) };
}

// ─── Holat o'tishlari ────────────────────────────────────────────────────────

/** Sklad xodimi faqat o'z omborining chiquvchi/kiruvchi partiyasiga tegadi. */
function assertWarehouseScope(
  session: SessionPayload,
  batchWarehouseId: string,
) {
  if (session.warehouseId && session.warehouseId !== batchWarehouseId) {
    throw new Error("FORBIDDEN_WAREHOUSE");
  }
}

export async function startLoading(batchId: string) {
  const session = await requireAny(["tms.manage", "tms.load"]);
  const b = await db.query.batches.findFirst({ where: eq(batches.id, batchId) });
  if (!b) throw new Error("NOT_FOUND");
  assertWarehouseScope(session, b.originWarehouseId);
  if (b.status !== "planned") throw new Error("BAD_STATUS");
  await db.update(batches).set({ status: "loading", updatedAt: new Date() }).where(eq(batches.id, batchId));
}

/** Jo'natish: tarkibdagi yuklar yo'lga chiqadi (qoldiqdan chiqadi). */
export async function departBatch(batchId: string) {
  const session = await requireAny(["tms.manage", "tms.load"]);
  const b = await db.query.batches.findFirst({ where: eq(batches.id, batchId) });
  if (!b) throw new Error("NOT_FOUND");
  assertWarehouseScope(session, b.originWarehouseId);
  if (b.status !== "planned" && b.status !== "loading") throw new Error("BAD_STATUS");

  const dest = await db.query.warehouses.findFirst({
    where: eq(warehouses.id, b.destinationWarehouseId),
  });
  if (!dest) throw new Error("WAREHOUSE_NOT_FOUND");
  const { inTransit } = legStatuses(dest.country, dest.kind);

  const items = await db
    .select({ cargoId: batchCargos.cargoId, status: cargos.status })
    .from(batchCargos)
    .innerJoin(cargos, eq(batchCargos.cargoId, cargos.id))
    .where(eq(batchCargos.batchId, batchId));
  if (items.length === 0) throw new Error("EMPTY_BATCH");

  // Har karobka scan qilingan bo'lishi SHART — aks holda jo'natilmaydi.
  const prog = await loadProgress(batchId);
  if (prog.total === 0) throw new Error("EMPTY_BATCH");
  if (prog.done < prog.total) {
    throw new Error(`LOAD_INCOMPLETE:${prog.done}:${prog.total}`);
  }

  await db.transaction(async (tx) => {
    for (const it of items) {
      await tx
        .update(cargos)
        .set({ status: inTransit, currentWarehouseId: null, updatedAt: new Date() })
        .where(eq(cargos.id, it.cargoId));
      await tx.insert(cargoEvents).values({
        cargoId: it.cargoId,
        type: "status_change",
        fromStatus: it.status,
        toStatus: inTransit,
        data: { batch: b.code },
        userId: session.sub,
      });
    }
    await tx
      .update(batches)
      .set({ status: "departed", departedAt: new Date(), updatedAt: new Date() })
      .where(eq(batches.id, batchId));
  });

  await db.insert(auditLog).values({
    userId: session.sub,
    action: "depart",
    entity: "batch",
    entityId: batchId,
    payload: { code: b.code, cargos: items.length },
  });
}

export async function arriveBatch(batchId: string) {
  await requireAny(["tms.manage", "tms.load"]);
  const b = await db.query.batches.findFirst({ where: eq(batches.id, batchId) });
  if (!b) throw new Error("NOT_FOUND");
  if (b.status !== "departed") throw new Error("BAD_STATUS");
  await db
    .update(batches)
    .set({ status: "arrived", arrivedAt: new Date(), updatedAt: new Date() })
    .where(eq(batches.id, batchId));
}

/** Tushirish: yuklar manzil omboriga tushadi (qoldiqda ko'rinadi). */
export async function unloadBatch(batchId: string) {
  const session = await requireAny(["tms.manage", "tms.load"]);
  const b = await db.query.batches.findFirst({ where: eq(batches.id, batchId) });
  if (!b) throw new Error("NOT_FOUND");
  assertWarehouseScope(session, b.destinationWarehouseId);
  if (b.status !== "departed" && b.status !== "arrived") throw new Error("BAD_STATUS");

  const dest = await db.query.warehouses.findFirst({
    where: eq(warehouses.id, b.destinationWarehouseId),
  });
  if (!dest) throw new Error("WAREHOUSE_NOT_FOUND");
  const { arrived } = legStatuses(dest.country, dest.kind);

  const items = await db
    .select({ cargoId: batchCargos.cargoId, status: cargos.status })
    .from(batchCargos)
    .innerJoin(cargos, eq(batchCargos.cargoId, cargos.id))
    .where(eq(batchCargos.batchId, batchId));

  // Qabulda scan qilinmay qolgan karobkalar = yo'lda yo'qolgan (missing).
  // Har yuk bo'yicha nechta yetishmayotganini sanaymiz (exception uchun).
  const missingRows = await db
    .select({ cargoId: batchBoxes.cargoId, n: count() })
    .from(batchBoxes)
    .where(and(eq(batchBoxes.batchId, batchId), eq(batchBoxes.unloadedScan, false)))
    .groupBy(batchBoxes.cargoId);
  const missingByCargo = new Map(missingRows.map((r) => [r.cargoId, r.n]));
  const totalMissing = missingRows.reduce((s, r) => s + r.n, 0);

  await db.transaction(async (tx) => {
    // Yetishmagan karobkalarni belgilaymiz.
    await tx
      .update(batchBoxes)
      .set({ flag: "missing" })
      .where(and(eq(batchBoxes.batchId, batchId), eq(batchBoxes.unloadedScan, false)));

    for (const it of items) {
      await tx
        .update(cargos)
        .set({ status: arrived, currentWarehouseId: b.destinationWarehouseId, updatedAt: new Date() })
        .where(eq(cargos.id, it.cargoId));
      await tx.insert(cargoEvents).values({
        cargoId: it.cargoId,
        type: "status_change",
        fromStatus: it.status,
        toStatus: arrived,
        data: { batch: b.code, warehouse: dest.code },
        userId: session.sub,
      });
      // Kamomad bo'lsa — alohida istisno hodisasi (logistga signal uchun).
      const miss = missingByCargo.get(it.cargoId);
      if (miss) {
        await tx.insert(cargoEvents).values({
          cargoId: it.cargoId,
          type: "shortage",
          data: { batch: b.code, warehouse: dest.code, missingBoxes: miss },
          comment: `Qabulda ${miss} ta karobka yetishmadi`,
          userId: session.sub,
        });
      }
    }
    await tx
      .update(batches)
      .set({
        status: "unloaded",
        arrivedAt: b.arrivedAt ?? new Date(),
        unloadedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(batches.id, batchId));
  });

  await db.insert(auditLog).values({
    userId: session.sub,
    action: "unload",
    entity: "batch",
    entityId: batchId,
    payload: { code: b.code, warehouse: dest.code, cargos: items.length, missingBoxes: totalMissing },
  });
}

export async function closeBatch(batchId: string) {
  await requirePermission("tms.manage");
  const b = await db.query.batches.findFirst({ where: eq(batches.id, batchId) });
  if (!b) throw new Error("NOT_FOUND");
  if (b.status !== "unloaded") throw new Error("BAD_STATUS");
  await db.update(batches).set({ status: "closed", updatedAt: new Date() }).where(eq(batches.id, batchId));
}

// ─── Qashqar konsolidatsiyasi ────────────────────────────────────────────────
// Qashqarda (konsolidatsiya ombori) turgan yuklar mijoz bo'yicha guruhlanadi,
// qaysi partiyadan kelgani ko'rsatiladi va shu yerdan xalqaro KA partiya
// yasaladi (Qashqar → O'zbekiston).

export type ConsolidationCargo = {
  cargoId: string;
  regNumber: string;
  boxes: number;
  weightKg: number;
  volumeM3: number;
  receivedAt: Date;
  arrivedOn: string | null; // kelgan partiya kodi (YW_003...)
  onOutbound: boolean; // ochiq KA partiyaga qo'shilganmi
};

export type ConsolidationClient = {
  clientId: string;
  code: string;
  name: string;
  cargoCount: number;
  totalBoxes: number;
  totalWeightKg: number;
  totalVolumeM3: number;
  cargos: ConsolidationCargo[];
};

export async function getKashgarConsolidation() {
  const session = await requirePermission("tms.view");

  const consWh = await db.query.warehouses.findMany({
    where: and(eq(warehouses.isActive, true), eq(warehouses.kind, "consolidation")),
  });
  let scopeIds = consWh.map((w) => w.id);
  if (session.warehouseId) {
    if (!scopeIds.includes(session.warehouseId)) {
      return { warehouse: null, clients: [] as ConsolidationClient[], totals: emptyTotals(), toUzWarehouses: [] };
    }
    scopeIds = [session.warehouseId];
  }
  if (scopeIds.length === 0) {
    return { warehouse: consWh[0] ?? null, clients: [] as ConsolidationClient[], totals: emptyTotals(), toUzWarehouses: [] };
  }

  const rows = await db
    .select({
      cargoId: cargos.id,
      regNumber: cargos.regNumber,
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
        eq(cargos.status, "at_kashgar"),
        inArray(cargos.currentWarehouseId, scopeIds),
      ),
    )
    .orderBy(asc(clients.code), asc(cargos.receivedAt));

  const cargoIds = rows.map((r) => r.cargoId);

  // Har yuk qaysi partiyada Qashqarga keldi (dest = konsolidatsiya ombori):
  const arrivals = cargoIds.length
    ? await db
        .select({
          cargoId: batchCargos.cargoId,
          code: batches.code,
          unloadedAt: batches.unloadedAt,
        })
        .from(batchCargos)
        .innerJoin(batches, eq(batchCargos.batchId, batches.id))
        .where(
          and(
            inArray(batchCargos.cargoId, cargoIds),
            inArray(batches.destinationWarehouseId, scopeIds),
          ),
        )
    : [];
  const arrivedOn = new Map<string, string>();
  for (const a of arrivals) {
    // eng oxirgi kelishni saqlaymiz
    if (!arrivedOn.has(a.cargoId)) arrivedOn.set(a.cargoId, a.code);
  }

  // Ochiq (yopilmagan) chiquvchi partiyalarga band qilinganlar:
  const busy = cargoIds.length
    ? await db
        .select({ cargoId: batchCargos.cargoId })
        .from(batchCargos)
        .innerJoin(batches, eq(batchCargos.batchId, batches.id))
        .where(
          and(
            inArray(batchCargos.cargoId, cargoIds),
            inArray(batches.originWarehouseId, scopeIds),
            ne(batches.status, "closed"),
          ),
        )
    : [];
  const busySet = new Set(busy.map((b) => b.cargoId));

  const byClient = new Map<string, ConsolidationClient>();
  const totals = emptyTotals();
  for (const r of rows) {
    const kg = Number(r.kg);
    const m3 = Number(r.m3);
    const c =
      byClient.get(r.clientCode) ??
      ({
        clientId: r.clientId,
        code: r.clientCode,
        name: r.clientName,
        cargoCount: 0,
        totalBoxes: 0,
        totalWeightKg: 0,
        totalVolumeM3: 0,
        cargos: [],
      } satisfies ConsolidationClient);
    c.cargoCount += 1;
    c.totalBoxes += r.boxes;
    c.totalWeightKg += kg;
    c.totalVolumeM3 += m3;
    c.cargos.push({
      cargoId: r.cargoId,
      regNumber: r.regNumber,
      boxes: r.boxes,
      weightKg: kg,
      volumeM3: m3,
      receivedAt: r.receivedAt,
      arrivedOn: arrivedOn.get(r.cargoId) ?? null,
      onOutbound: busySet.has(r.cargoId),
    });
    byClient.set(r.clientCode, c);

    totals.cargoCount += 1;
    totals.totalBoxes += r.boxes;
    totals.totalWeightKg += kg;
    totals.totalVolumeM3 += m3;
  }

  const clientList = [...byClient.values()].map((c) => ({
    ...c,
    totalWeightKg: Math.round(c.totalWeightKg * 1000) / 1000,
    totalVolumeM3: Math.round(c.totalVolumeM3 * 10000) / 10000,
  }));

  // KA partiya uchun manzil omborlar (O'zbekiston):
  const toUzWarehouses = await db.query.warehouses.findMany({
    where: and(eq(warehouses.isActive, true), eq(warehouses.country, "UZ")),
    orderBy: asc(warehouses.gsCode),
    columns: { id: true, code: true, gsCode: true, name: true },
  });

  return {
    warehouse: consWh.find((w) => scopeIds.includes(w.id)) ?? consWh[0] ?? null,
    clients: clientList,
    totals: {
      ...totals,
      totalWeightKg: Math.round(totals.totalWeightKg * 1000) / 1000,
      totalVolumeM3: Math.round(totals.totalVolumeM3 * 10000) / 10000,
    },
    toUzWarehouses,
  };
}

function emptyTotals() {
  return { cargoCount: 0, totalBoxes: 0, totalWeightKg: 0, totalVolumeM3: 0 };
}

/** Forma uchun: origin/destination omborlar va faol mashinalar. */
export async function getBatchFormData() {
  await requirePermission("tms.manage");
  const [whList, carrierList] = await Promise.all([
    db.query.warehouses.findMany({
      where: eq(warehouses.isActive, true),
      orderBy: [asc(warehouses.country), asc(warehouses.gsCode)],
      columns: { id: true, code: true, gsCode: true, name: true, country: true, kind: true },
    }),
    db.query.carriers.findMany({
      where: eq(carriers.isActive, true),
      orderBy: asc(carriers.name),
      columns: { id: true, name: true, truckPlate: true, capacityKg: true, capacityM3: true },
    }),
  ]);
  return { warehouses: whList, carriers: carrierList };
}
