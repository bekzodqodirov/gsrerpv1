// TMS servisi: yollanma mashinalar, partiyalar, yuklash rejasi va holat o'tishlari.
//
// Kelishilgan narx (agreedPrice) — nozik ma'lumot. Faqat tms.manage huquqiga
// ega foydalanuvchi ko'radi; sklad xodimiga hech qachon qaytarilmaydi.
import { and, asc, count, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  carriers,
  batches,
  batchCargos,
  batchLines,
  batchBoxes,
  batchPallets,
  cargos,
  cargoBoxes,
  cargoLines,
  cargoEvents,
  clients,
  warehouses,
  auditLog,
  docSequences,
  attachments,
  users,
  pallets,
} from "@/db/schema";
import type { ScanResult } from "./dto";
import { palletBoxIds } from "@/modules/repack/service";
import { splitCargoRemainder } from "@/modules/cargo/split";
import { getSession, requirePermission } from "@/modules/shared/auth";
import type { SessionPayload } from "@/modules/shared/session";
import { nextNumber } from "@/modules/shared/numbering";
import {
  carrierSchema,
  batchCreateSchema,
  batchUpdateSchema,
  legStatuses,
  sourceStatusForOrigin,
  type CarrierInput,
  type BatchCreateInput,
  type BatchUpdateInput,
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

/**
 * Skaner kodi karobkani MATN QR (YK-...-B037) yoki QISQA RAQAMLI global ID
 * (box_uid, RFID/EPC ga mos) bo'yicha topadi — ikkalasi ham qabul qilinadi.
 */
function boxCodeCond(code: string) {
  const c = code.trim();
  if (/^\d+$/.test(c)) {
    const uid = Number(c);
    if (Number.isSafeInteger(uid)) {
      return or(eq(cargoBoxes.qrCode, c), eq(cargoBoxes.boxUid, uid))!;
    }
  }
  return eq(cargoBoxes.qrCode, c);
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

  // Partiya nomi: logist berganini ishlatamiz (takror bo'lmasin), bo'sh — avto.
  let code: string;
  if (data.code) {
    code = data.code.toUpperCase();
    const taken = await db.query.batches.findFirst({
      where: eq(batches.code, code),
      columns: { id: true },
    });
    if (taken) throw new Error("CODE_TAKEN");
  } else {
    code = await nextBatchCode(origin.code);
  }
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

/** Partiyani tahrirlash — FAQAT planned/loading holatida (jo'nagach o'zgarmaydi).
 * Origin o'zgarmaydi (plan o'sha ombor qoldig'iga bog'liq); manzil, mashina,
 * plomba, narx, izoh o'zgartiriladi. Mashinani keyin biriktirish shu orqali. */
export async function updateBatch(id: string, input: BatchUpdateInput) {
  const session = await requirePermission("tms.manage");
  const data = batchUpdateSchema.parse(input);

  const b = await db.query.batches.findFirst({ where: eq(batches.id, id) });
  if (!b) throw new Error("NOT_FOUND");
  if (b.status !== "planned" && b.status !== "loading") {
    throw new Error("NOT_EDITABLE");
  }
  if (data.destinationWarehouseId === b.originWarehouseId) {
    throw new Error("SAME_WAREHOUSE");
  }
  const dest = await db.query.warehouses.findFirst({
    where: eq(warehouses.id, data.destinationWarehouseId),
  });
  if (!dest) throw new Error("WAREHOUSE_NOT_FOUND");

  await db
    .update(batches)
    .set({
      destinationWarehouseId: dest.id,
      carrierId: data.carrierId || null,
      agreedPrice: data.agreedPrice != null ? String(data.agreedPrice) : null,
      currency: data.currency || null,
      sealNumber: data.sealNumber || null,
      note: data.note || null,
      updatedAt: new Date(),
    })
    .where(eq(batches.id, id));

  await db.insert(auditLog).values({
    userId: session.sub,
    action: "update",
    entity: "batch",
    entityId: id,
    payload: { dest: dest.code, carrier: data.carrierId || null },
  });
  return { id };
}

/** Partiyalar ro'yxati. Sklad XODIMIGA faqat o'z omboriga tegishlilari —
 * va faqat HOZIR ish talab qiladiganlari: o'zidan chiqadigan (planned/loading,
 * yuklash ketyapti) yoki o'ziga kelayotgan (departed/arrived, tushirish
 * kutilyapti). Jo'nab ketgan/yopilgan partiya skladchiga endi kerak emas.
 * Skladga biriktirilgan MENEJER (tms.manage) esa o'z omborining BARCHA
 * partiyalarini ko'radi — unloaded'ni yopish (closeBatch) uning vazifasi. */
export async function listBatches(opts: { archived?: boolean } = {}) {
  const session = await requirePermission("tms.view");
  const isManager =
    session.perms.includes("*") || session.perms.includes("tms.manage");
  const archived = opts.archived === true;
  const conds = [];

  // ARXIV: jo'natilgan/qabul qilingan (yakunlangan) partiyalar — keyin ko'rish
  // uchun. Skladchi o'zi JO'NATGANini (origin) va QABUL qilganini (dest)
  // ko'radi; menejer barcha yopilgan/tushirilgan partiyalarni.
  if (archived) {
    if (session.warehouseId && !isManager) {
      conds.push(
        or(
          and(
            eq(batches.originWarehouseId, session.warehouseId),
            inArray(batches.status, ["departed", "arrived", "unloaded", "closed"]),
          ),
          and(
            eq(batches.destinationWarehouseId, session.warehouseId),
            inArray(batches.status, ["unloaded", "closed"]),
          ),
        )!,
      );
    } else {
      conds.push(inArray(batches.status, ["unloaded", "closed"]));
      if (session.warehouseId) {
        conds.push(
          or(
            eq(batches.originWarehouseId, session.warehouseId),
            eq(batches.destinationWarehouseId, session.warehouseId),
          )!,
        );
      }
    }
  } else if (session.warehouseId) {
    conds.push(
      isManager
        ? or(
            eq(batches.originWarehouseId, session.warehouseId),
            eq(batches.destinationWarehouseId, session.warehouseId),
          )!
        : or(
            and(
              eq(batches.originWarehouseId, session.warehouseId),
              inArray(batches.status, ["planned", "loading"]),
            ),
            and(
              eq(batches.destinationWarehouseId, session.warehouseId),
              inArray(batches.status, ["departed", "arrived"]),
            ),
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

  // PLAN — tovar (qator) darajasida: zona bo'yicha tartiblangan ish varag'i.
  const planRows = await db
    .select({
      lineId: batchLines.lineId,
      cargoId: batchLines.cargoId,
      planned: batchLines.plannedBoxes,
      letterCode: cargoLines.letterCode,
      productName: cargoLines.productName,
      lineBoxCount: cargoLines.boxCount,
      lineKg: cargoLines.totalWeightKg,
      lineM3: cargoLines.totalVolumeM3,
      regNumber: cargos.regNumber,
      zone: cargos.storageZone,
      clientCode: clients.code,
      clientName: clients.name,
    })
    .from(batchLines)
    .innerJoin(cargoLines, eq(batchLines.lineId, cargoLines.id))
    .innerJoin(cargos, eq(batchLines.cargoId, cargos.id))
    .innerJoin(clients, eq(cargos.clientId, clients.id))
    .where(eq(batchLines.batchId, id))
    .orderBy(asc(cargos.storageZone), asc(clients.code), asc(cargoLines.lineNo));

  // Rasmlar (har qatorning birinchisi):
  const planLineIds = planRows.map((r) => r.lineId);
  const photoRows = planLineIds.length
    ? await db
        .select({
          entityId: attachments.entityId,
          id: attachments.id,
          mimeType: attachments.mimeType,
        })
        .from(attachments)
        .where(
          and(
            eq(attachments.entity, "cargo_line"),
            inArray(attachments.entityId, planLineIds),
          ),
        )
        .orderBy(asc(attachments.createdAt))
    : [];
  const photoByLine = new Map<string, string>();
  for (const p of photoRows) {
    if (p.mimeType.startsWith("image/") && !photoByLine.has(p.entityId)) {
      photoByLine.set(p.entityId, p.id);
    }
  }

  // PLAN — YASHIK (paddon) birliklari: har biri 1 birlik (ichidagi karobkalar
  // alohida sanalmaydi). Og'irlik/hajm ichidagilardan yig'iladi.
  const palPlanRows = await db
    .select({
      id: batchPallets.id,
      palletId: batchPallets.palletId,
      code: pallets.code,
      clientCode: clients.code,
      clientName: clients.name,
      loadedScan: batchPallets.loadedScan,
      unloadedScan: batchPallets.unloadedScan,
    })
    .from(batchPallets)
    .innerJoin(pallets, eq(batchPallets.palletId, pallets.id))
    .innerJoin(clients, eq(pallets.clientId, clients.id))
    .where(eq(batchPallets.batchId, id))
    .orderBy(asc(pallets.code));
  const batchPalletIdSet = new Set(palPlanRows.map((r) => r.palletId));
  const palBoxRows = palPlanRows.length
    ? await db
        .select({
          palletId: cargoBoxes.palletId,
          lineKg: cargoLines.totalWeightKg,
          lineM3: cargoLines.totalVolumeM3,
          lineBoxCount: cargoLines.boxCount,
        })
        .from(cargoBoxes)
        .innerJoin(cargoLines, eq(cargoBoxes.lineId, cargoLines.id))
        .where(inArray(cargoBoxes.palletId, palPlanRows.map((r) => r.palletId)))
    : [];
  const palAgg = new Map<string, { count: number; kg: number; m3: number }>();
  for (const r of palBoxRows) {
    const pid = r.palletId!;
    const a = palAgg.get(pid) ?? { count: 0, kg: 0, m3: 0 };
    const n = r.lineBoxCount || 1;
    a.count += 1;
    a.kg += Number(r.lineKg) / n;
    a.m3 += Number(r.lineM3) / n;
    palAgg.set(pid, a);
  }

  // Scan holati — qator bo'yicha. Yashik BIRLIGIGA kirgan karobkalar bu yerda
  // SANALMAYDI (ular yashik birligi sifatida alohida hisoblanadi).
  const bbRows = await db
    .select({
      lineId: cargoBoxes.lineId,
      palletId: cargoBoxes.palletId,
      loaded: batchBoxes.loadedScan,
      unloaded: batchBoxes.unloadedScan,
      flag: batchBoxes.flag,
    })
    .from(batchBoxes)
    .innerJoin(cargoBoxes, eq(batchBoxes.boxId, cargoBoxes.id))
    .where(eq(batchBoxes.batchId, id));
  const scanByLine = new Map<
    string,
    { loaded: number; unloaded: number; missing: number }
  >();
  let loadDone = 0;
  let unloadDone = 0;
  let missingTotal = 0;
  for (const r of bbRows) {
    // Yashik birligiga tegishli karobka — bo'sh (loose) hisobga kirmaydi.
    if (r.palletId && batchPalletIdSet.has(r.palletId)) continue;
    const s = scanByLine.get(r.lineId) ?? { loaded: 0, unloaded: 0, missing: 0 };
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
    scanByLine.set(r.lineId, s);
  }
  const palLoaded = palPlanRows.filter((p) => p.loadedScan).length;
  const palUnloaded = palPlanRows.filter((p) => p.unloadedScan).length;
  const palletUnits = palPlanRows.map((p) => {
    const a = palAgg.get(p.palletId) ?? { count: 0, kg: 0, m3: 0 };
    return {
      palletId: p.palletId,
      code: p.code,
      clientCode: p.clientCode,
      clientName: p.clientName,
      boxCount: a.count,
      weightKg: Math.round(a.kg * 1000) / 1000,
      volumeM3: Math.round(a.m3 * 10000) / 10000,
      loaded: p.loadedScan,
      unloaded: p.unloadedScan,
    };
  });
  const palTotalKg = palletUnits.reduce((s, p) => s + p.weightKg, 0);
  const palTotalM3 = palletUnits.reduce((s, p) => s + p.volumeM3, 0);

  // Kim nechta karobka yukladi (ishchilar hisobi):
  const workerRows = await db
    .select({
      userId: batchBoxes.loadedBy,
      fullName: users.fullName,
      n: count(),
    })
    .from(batchBoxes)
    .leftJoin(users, eq(batchBoxes.loadedBy, users.id))
    .where(and(eq(batchBoxes.batchId, id), eq(batchBoxes.loadedScan, true)))
    .groupBy(batchBoxes.loadedBy, users.fullName)
    .orderBy(desc(count()));

  const lines = planRows.map((r) => {
    const perBoxKg = r.lineBoxCount ? Number(r.lineKg) / r.lineBoxCount : 0;
    const perBoxM3 = r.lineBoxCount ? Number(r.lineM3) / r.lineBoxCount : 0;
    const s = scanByLine.get(r.lineId) ?? { loaded: 0, unloaded: 0, missing: 0 };
    return {
      lineId: r.lineId,
      cargoId: r.cargoId,
      regNumber: r.regNumber,
      zone: r.zone,
      letterCode: r.letterCode,
      productName: r.productName,
      clientCode: r.clientCode,
      clientName: r.clientName,
      lineBoxCount: r.lineBoxCount,
      planned: r.planned,
      loaded: s.loaded,
      unloaded: s.unloaded,
      missing: s.missing,
      plannedKg: perBoxKg * r.planned,
      plannedM3: perBoxM3 * r.planned,
      photoId: photoByLine.get(r.lineId) ?? null,
    };
  });

  const planTotals = lines.reduce(
    (t, l) => ({
      lineCount: t.lineCount + 1,
      boxes: t.boxes + l.planned,
      kg: t.kg + l.plannedKg,
      m3: t.m3 + l.plannedM3,
    }),
    { lineCount: 0, boxes: 0, kg: 0, m3: 0 },
  );
  const totalPlanned = planTotals.boxes;

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
    lines,
    pallets: palletUnits,
    workers: workerRows.map((w) => ({
      name: w.fullName ?? "—",
      n: Number(w.n),
    })),
    totals: {
      lineCount: planTotals.lineCount,
      totalBoxes: totalPlanned,
      palletCount: palPlanRows.length,
      totalWeightKg: Math.round((planTotals.kg + palTotalKg) * 1000) / 1000,
      totalVolumeM3: Math.round((planTotals.m3 + palTotalM3) * 10000) / 10000,
    },
    // Yashik = 1 birlik: progress = bo'sh karobkalar + yashik birliklari.
    loadProgress: {
      done: loadDone + palLoaded,
      total: totalPlanned + palPlanRows.length,
    },
    unloadProgress: {
      done: unloadDone + palUnloaded,
      total: loadDone + palLoaded,
    },
    missingCount: missingTotal,
    canManage: session.perms.includes("*") || session.perms.includes("tms.manage"),
    canLoad:
      session.perms.includes("*") ||
      session.perms.includes("tms.load") ||
      session.perms.includes("tms.manage"),
    // Tomonga bog'liq: yuklash — jo'natuvchi omborda, tushirish — qabul qiluvchida.
    canScanLoad:
      (session.perms.includes("*") ||
        session.perms.includes("tms.load") ||
        session.perms.includes("tms.manage")) &&
      (!session.warehouseId || session.warehouseId === b.originWarehouseId),
    canScanUnload:
      (session.perms.includes("*") ||
        session.perms.includes("tms.load") ||
        session.perms.includes("tms.manage")) &&
      (!session.warehouseId || session.warehouseId === b.destinationWarehouseId),
  };
}

/** Skaner ekrani uchun YENGIL ma'lumot: partiya + progress. Manifest, plan,
 * rasmlar va ishchilar hisobisiz — telefonda sahifa tez ochilishi uchun. */
export async function getBatchScanInfo(id: string) {
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

  const [origin, dest, load, unload] = await Promise.all([
    db.query.warehouses.findFirst({ where: eq(warehouses.id, b.originWarehouseId) }),
    db.query.warehouses.findFirst({ where: eq(warehouses.id, b.destinationWarehouseId) }),
    loadProgress(id),
    unloadProgress(id),
  ]);

  const hasLoadPerm =
    session.perms.includes("*") ||
    session.perms.includes("tms.load") ||
    session.perms.includes("tms.manage");

  return {
    batch: { id: b.id, code: b.code, status: b.status },
    origin: origin ? { gsCode: origin.gsCode, name: origin.name } : null,
    dest: dest ? { gsCode: dest.gsCode, name: dest.name } : null,
    loadProgress: load,
    unloadProgress: unload,
    canLoad: hasLoadPerm,
    // Tomonga bog'liq ruxsat: yuklash — faqat jo'natuvchi omborda, tushirish —
    // faqat qabul qiluvchi omborda (scanLoad/scanUnload ham shuni talab qiladi).
    canScanLoad:
      hasLoadPerm &&
      (!session.warehouseId || session.warehouseId === b.originWarehouseId),
    canScanUnload:
      hasLoadPerm &&
      (!session.warehouseId || session.warehouseId === b.destinationWarehouseId),
  };
}

// ─── Yuklash rejasi: TOVAR (qator) darajasida ────────────────────────────────

/** Ochiq (planned/loading) partiyalarda band qilingan karobkalar soni — qator bo'yicha. */
async function plannedInOpenBatches(
  excludeBatchId?: string,
): Promise<Map<string, number>> {
  const conds = [inArray(batches.status, ["planned", "loading"])];
  if (excludeBatchId) conds.push(ne(batchLines.batchId, excludeBatchId));
  const rows = await db
    .select({
      lineId: batchLines.lineId,
      planned: sql<number>`sum(${batchLines.plannedBoxes})::int`,
    })
    .from(batchLines)
    .innerJoin(batches, eq(batchLines.batchId, batches.id))
    .where(and(...conds))
    .groupBy(batchLines.lineId);
  return new Map(rows.map((r) => [r.lineId, Number(r.planned)]));
}

/** Ochiq (planned/loading) partiyalarda band qilingan YASHIKLAR (palletId to'plami). */
async function palletsInOpenBatches(
  excludeBatchId?: string,
): Promise<Set<string>> {
  const conds = [inArray(batches.status, ["planned", "loading"])];
  if (excludeBatchId) conds.push(ne(batchPallets.batchId, excludeBatchId));
  const rows = await db
    .select({ palletId: batchPallets.palletId })
    .from(batchPallets)
    .innerJoin(batches, eq(batchPallets.batchId, batches.id))
    .where(and(...conds));
  return new Set(rows.map((r) => r.palletId));
}

/** Qatorlarning YOPIQ yashiklardagi karobkalari soni (qator bo'yicha) — bu
 * karobkalar bo'sh (loose) planga kirmaydi, chunki yashik = 1 birlik. */
async function boxesInClosedPalletsByLine(
  lineIds: string[],
): Promise<Map<string, number>> {
  if (!lineIds.length) return new Map();
  const rows = await db
    .select({ lineId: cargoBoxes.lineId, n: count() })
    .from(cargoBoxes)
    .innerJoin(pallets, eq(cargoBoxes.palletId, pallets.id))
    .where(
      and(inArray(cargoBoxes.lineId, lineIds), eq(pallets.status, "closed")),
    )
    .groupBy(cargoBoxes.lineId);
  return new Map(rows.map((r) => [r.lineId, Number(r.n)]));
}

/** Shu partiyada qator bo'yicha haqiqatda scan qilingan (yuklangan) karobkalar. */
async function scannedByLine(batchId: string): Promise<Map<string, number>> {
  const rows = await db
    .select({
      lineId: cargoBoxes.lineId,
      n: count(),
    })
    .from(batchBoxes)
    .innerJoin(cargoBoxes, eq(batchBoxes.boxId, cargoBoxes.id))
    .where(and(eq(batchBoxes.batchId, batchId), eq(batchBoxes.loadedScan, true)))
    .groupBy(cargoBoxes.lineId);
  return new Map(rows.map((r) => [r.lineId, Number(r.n)]));
}

/**
 * Plan tuzish uchun: origin ombordagi TOVARLAR ro'yxati — rasm, nom, o'lchamlar,
 * mavjud karobka soni (boshqa ochiq partiyalarga band qilinganlari ayirilgan).
 */
export async function getAvailableLines(batchId: string) {
  await requirePermission("tms.view");
  const b = await db.query.batches.findFirst({ where: eq(batches.id, batchId) });
  if (!b) return [];
  const origin = await db.query.warehouses.findFirst({
    where: eq(warehouses.id, b.originWarehouseId),
  });
  if (!origin) return [];
  const sourceStatus = sourceStatusForOrigin(origin.kind);

  const rows = await db
    .select({
      lineId: cargoLines.id,
      cargoId: cargos.id,
      regNumber: cargos.regNumber,
      zone: cargos.storageZone,
      receivedAt: cargos.receivedAt,
      letterCode: cargoLines.letterCode,
      productName: cargoLines.productName,
      boxCount: cargoLines.boxCount,
      lineKg: cargoLines.totalWeightKg,
      lineM3: cargoLines.totalVolumeM3,
      clientCode: clients.code,
      clientName: clients.name,
    })
    .from(cargoLines)
    .innerJoin(cargos, eq(cargoLines.cargoId, cargos.id))
    .innerJoin(clients, eq(cargos.clientId, clients.id))
    .where(
      and(
        eq(cargos.voided, false),
        eq(cargos.status, sourceStatus),
        eq(cargos.currentWarehouseId, b.originWarehouseId),
      ),
    )
    .orderBy(asc(cargos.receivedAt), asc(cargoLines.lineNo)); // FIFO

  const planned = await plannedInOpenBatches();
  const thisPlan = await db.query.batchLines.findMany({
    where: eq(batchLines.batchId, batchId),
    columns: { lineId: true, plannedBoxes: true },
  });
  const thisPlanMap = new Map(thisPlan.map((p) => [p.lineId, p.plannedBoxes]));
  // Yopiq yashiklardagi karobkalar bo'sh planga kirmaydi (yashik = 1 birlik).
  const inClosedPallets = await boxesInClosedPalletsByLine(
    rows.map((r) => r.lineId),
  );

  // Har qatorning birinchi rasmi (bitta so'rovda):
  const lineIds = rows.map((r) => r.lineId);
  const photoRows = lineIds.length
    ? await db
        .select({
          entityId: attachments.entityId,
          id: attachments.id,
          mimeType: attachments.mimeType,
        })
        .from(attachments)
        .where(
          and(
            eq(attachments.entity, "cargo_line"),
            inArray(attachments.entityId, lineIds),
          ),
        )
        .orderBy(asc(attachments.createdAt))
    : [];
  const photoByLine = new Map<string, string>();
  for (const p of photoRows) {
    if (p.mimeType.startsWith("image/") && !photoByLine.has(p.entityId)) {
      photoByLine.set(p.entityId, p.id);
    }
  }

  return rows
    .map((r) => {
      const inOpen = planned.get(r.lineId) ?? 0;
      const inPallet = inClosedPallets.get(r.lineId) ?? 0;
      // Yopiq yashikdagi karobkalar bo'sh planga kirmaydi (yashik alohida birlik).
      const looseTotal = Math.max(0, r.boxCount - inPallet);
      const available = looseTotal - inOpen;
      const perBoxKg = r.boxCount ? Number(r.lineKg) / r.boxCount : 0;
      const perBoxM3 = r.boxCount ? Number(r.lineM3) / r.boxCount : 0;
      return {
        lineId: r.lineId,
        cargoId: r.cargoId,
        regNumber: r.regNumber,
        zone: r.zone,
        letterCode: r.letterCode,
        productName: r.productName,
        clientCode: r.clientCode,
        clientName: r.clientName,
        boxCount: looseTotal,
        availableBoxes: available,
        plannedThisBatch: thisPlanMap.get(r.lineId) ?? 0,
        perBoxKg,
        perBoxM3,
        photoId: photoByLine.get(r.lineId) ?? null,
      };
    })
    .filter((r) => r.availableBoxes > 0);
}

/**
 * Plan tuzish uchun: origin ombordagi YOPIQ YASHIKLAR — har biri 1 BIRLIK
 * (ichidagi karobkalar bilan). Boshqa ochiq partiyaga band bo'lganlari va
 * yuklanib jo'nab ketganlari chiqarilmaydi.
 */
export async function getAvailablePallets(batchId: string) {
  await requirePermission("tms.view");
  const b = await db.query.batches.findFirst({ where: eq(batches.id, batchId) });
  if (!b) return [];
  const origin = await db.query.warehouses.findFirst({
    where: eq(warehouses.id, b.originWarehouseId),
  });
  if (!origin) return [];
  const sourceStatus = sourceStatusForOrigin(origin.kind);

  const palRows = await db
    .select({
      palletId: pallets.id,
      code: pallets.code,
      clientCode: clients.code,
      clientName: clients.name,
    })
    .from(pallets)
    .innerJoin(clients, eq(pallets.clientId, clients.id))
    .where(
      and(
        eq(pallets.warehouseId, b.originWarehouseId),
        eq(pallets.status, "closed"),
      ),
    )
    .orderBy(asc(pallets.code));
  if (!palRows.length) return [];
  const palletIds = palRows.map((r) => r.palletId);

  // Har yashikning karobkalari (og'irlik/hajm) + ichidagi yuk hali origin'dami.
  const boxRows = await db
    .select({
      palletId: cargoBoxes.palletId,
      lineKg: cargoLines.totalWeightKg,
      lineM3: cargoLines.totalVolumeM3,
      lineBoxCount: cargoLines.boxCount,
      cargoStatus: cargos.status,
      cargoWh: cargos.currentWarehouseId,
    })
    .from(cargoBoxes)
    .innerJoin(cargoLines, eq(cargoBoxes.lineId, cargoLines.id))
    .innerJoin(cargos, eq(cargoBoxes.cargoId, cargos.id))
    .where(inArray(cargoBoxes.palletId, palletIds));

  const agg = new Map<
    string,
    { count: number; kg: number; m3: number; eligible: boolean }
  >();
  for (const r of boxRows) {
    const pid = r.palletId!;
    const a = agg.get(pid) ?? { count: 0, kg: 0, m3: 0, eligible: true };
    const n = r.lineBoxCount || 1;
    a.count += 1;
    a.kg += Number(r.lineKg) / n;
    a.m3 += Number(r.lineM3) / n;
    // Yashik ichidagi biror yuk origin'da yotgan holatda bo'lmasa — mavjud emas.
    if (r.cargoStatus !== sourceStatus || r.cargoWh !== b.originWarehouseId) {
      a.eligible = false;
    }
    agg.set(pid, a);
  }

  const reserved = await palletsInOpenBatches(batchId);
  const thisPlan = new Set(
    (
      await db
        .select({ palletId: batchPallets.palletId })
        .from(batchPallets)
        .where(eq(batchPallets.batchId, batchId))
    ).map((r) => r.palletId),
  );

  return palRows
    .filter((r) => !reserved.has(r.palletId))
    .map((r) => {
      const a = agg.get(r.palletId) ?? { count: 0, kg: 0, m3: 0, eligible: false };
      return {
        palletId: r.palletId,
        code: r.code,
        clientCode: r.clientCode,
        clientName: r.clientName,
        boxCount: a.count,
        weightKg: Math.round(a.kg * 1000) / 1000,
        volumeM3: Math.round(a.m3 * 10000) / 10000,
        plannedThisBatch: thisPlan.has(r.palletId),
        eligible: a.eligible,
      };
    })
    // Bo'sh yoki jo'nab ketgan yashiklar (rejadagidan tashqari) chiqmaydi.
    .filter((r) => r.boxCount > 0 && (r.eligible || r.plannedThisBatch));
}

async function assertPlannable(batchId: string) {
  const b = await db.query.batches.findFirst({ where: eq(batches.id, batchId) });
  if (!b) throw new Error("NOT_FOUND");
  if (b.status !== "planned" && b.status !== "loading") {
    throw new Error("BATCH_LOCKED"); // jo'nagandan keyin tarkib o'zgarmaydi
  }
  return b;
}

/**
 * Plan qatorini o'rnatish: shu tovardan `boxes` ta karobka yuklanadi.
 * Scan qilinganidan kam yoki mavjuddan ko'p qilib bo'lmaydi.
 */
export async function setPlanLine(
  batchId: string,
  lineId: string,
  boxes: number,
) {
  const session = await requireAny(["tms.manage", "tms.load"]);
  const b = await assertPlannable(batchId);
  assertWarehouseScope(session, b.originWarehouseId);
  if (!Number.isInteger(boxes) || boxes < 1) throw new Error("BAD_COUNT");

  const line = await db.query.cargoLines.findFirst({
    where: eq(cargoLines.id, lineId),
  });
  if (!line) throw new Error("LINE_NOT_FOUND");
  const cargo = await db.query.cargos.findFirst({
    where: eq(cargos.id, line.cargoId),
  });
  if (!cargo || cargo.voided) throw new Error("CARGO_NOT_FOUND");
  if (cargo.currentWarehouseId !== b.originWarehouseId) {
    throw new Error("CARGO_NOT_AT_ORIGIN");
  }

  const plannedElsewhere = (await plannedInOpenBatches(batchId)).get(lineId) ?? 0;
  if (boxes > line.boxCount - plannedElsewhere) {
    throw new Error("PLAN_EXCEEDS_AVAILABLE");
  }
  const scanned = (await scannedByLine(batchId)).get(lineId) ?? 0;
  if (boxes < scanned) throw new Error("PLAN_BELOW_SCANNED");

  await db.transaction(async (tx) => {
    await tx
      .insert(batchLines)
      .values({ batchId, cargoId: line.cargoId, lineId, plannedBoxes: boxes })
      .onConflictDoUpdate({
        target: [batchLines.batchId, batchLines.lineId],
        set: { plannedBoxes: boxes },
      });
    await tx
      .insert(batchCargos)
      .values({ batchId, cargoId: line.cargoId })
      .onConflictDoNothing();
  });
}

/** Bir nechta plan qatorini birdan qo'shish (plan tuzuvchi UI uchun). */
export async function addPlanLines(
  batchId: string,
  items: { lineId: string; boxes: number }[],
) {
  for (const it of items) {
    await setPlanLine(batchId, it.lineId, it.boxes);
  }
}

/** Plan qatorini olib tashlash — faqat hali scan boshlanmagan bo'lsa. */
export async function removePlanLine(batchId: string, lineId: string) {
  const session = await requireAny(["tms.manage", "tms.load"]);
  const b = await assertPlannable(batchId);
  assertWarehouseScope(session, b.originWarehouseId);
  const scanned = (await scannedByLine(batchId)).get(lineId) ?? 0;
  if (scanned > 0) throw new Error("HAS_SCANS");

  const row = await db.query.batchLines.findFirst({
    where: and(eq(batchLines.batchId, batchId), eq(batchLines.lineId, lineId)),
  });
  if (!row) return;
  await db.transaction(async (tx) => {
    await tx.delete(batchLines).where(eq(batchLines.id, row.id));
    const left = await tx
      .select({ n: count() })
      .from(batchLines)
      .where(
        and(eq(batchLines.batchId, batchId), eq(batchLines.cargoId, row.cargoId)),
      );
    if (Number(left[0]?.n ?? 0) === 0) {
      await tx
        .delete(batchCargos)
        .where(
          and(
            eq(batchCargos.batchId, batchId),
            eq(batchCargos.cargoId, row.cargoId),
          ),
        );
    }
  });
}

// ─── Plan: YASHIK (paddon) birliklarini qo'shish/olib tashlash ───────────────

/** Yopiq yashikni partiya planiga BITTA BIRLIK bo'lib qo'shish. */
export async function addPlanPallets(batchId: string, palletIds: string[]) {
  const session = await requireAny(["tms.manage", "tms.load"]);
  const b = await assertPlannable(batchId);
  assertWarehouseScope(session, b.originWarehouseId);

  const reserved = await palletsInOpenBatches(batchId);
  for (const palletId of palletIds) {
    const pal = await db.query.pallets.findFirst({
      where: eq(pallets.id, palletId),
    });
    if (!pal || pal.status !== "closed") throw new Error("PALLET_NOT_READY");
    if (pal.warehouseId !== b.originWarehouseId) {
      throw new Error("PALLET_NOT_AT_ORIGIN");
    }
    if (reserved.has(palletId)) throw new Error("PALLET_RESERVED");
    await db
      .insert(batchPallets)
      .values({ batchId, palletId })
      .onConflictDoNothing();
  }
}

/** Yashik birligini plandan olib tashlash — faqat hali yuklanmagan bo'lsa. */
export async function removePlanPallet(batchId: string, palletId: string) {
  const session = await requireAny(["tms.manage", "tms.load"]);
  const b = await assertPlannable(batchId);
  assertWarehouseScope(session, b.originWarehouseId);
  const row = await db.query.batchPallets.findFirst({
    where: and(
      eq(batchPallets.batchId, batchId),
      eq(batchPallets.palletId, palletId),
    ),
  });
  if (!row) return;
  if (row.loadedScan) throw new Error("HAS_SCANS");
  await db.delete(batchPallets).where(eq(batchPallets.id, row.id));
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

// Yashik (paddon) = 1 BIRLIK: progress'da yashik ichidagi karobkalar alohida
// SANALMAYDI; bo'sh (loose) karobkalar + yashik birliklari birga hisoblanadi.
// Bo'sh karobka = shu partiya batch_pallet'iga tegishli bo'lmagan karobka.
const looseBoxCond = (batchId: string) =>
  and(
    eq(batchBoxes.batchId, batchId),
    isNull(batchPallets.id), // yashik birligiga kirmagan
  );

async function loadProgress(batchId: string) {
  const [looseTot] = await db
    .select({ total: sql<number>`coalesce(sum(${batchLines.plannedBoxes}), 0)::int` })
    .from(batchLines)
    .where(eq(batchLines.batchId, batchId));
  const [palTot] = await db
    .select({ total: count() })
    .from(batchPallets)
    .where(eq(batchPallets.batchId, batchId));
  const [looseDone] = await db
    .select({ done: count() })
    .from(batchBoxes)
    .innerJoin(cargoBoxes, eq(batchBoxes.boxId, cargoBoxes.id))
    .leftJoin(
      batchPallets,
      and(
        eq(batchPallets.batchId, batchId),
        eq(batchPallets.palletId, cargoBoxes.palletId),
      ),
    )
    .where(and(looseBoxCond(batchId), eq(batchBoxes.loadedScan, true)));
  const [palDone] = await db
    .select({ done: count() })
    .from(batchPallets)
    .where(
      and(eq(batchPallets.batchId, batchId), eq(batchPallets.loadedScan, true)),
    );
  return {
    done: Number(looseDone.done) + Number(palDone.done),
    total: Number(looseTot.total) + Number(palTot.total),
  };
}

async function unloadProgress(batchId: string) {
  // Jo'natilgan (yuklangan) bo'sh karobkalar + yuklangan yashiklar = total.
  const [looseTot] = await db
    .select({ total: count() })
    .from(batchBoxes)
    .innerJoin(cargoBoxes, eq(batchBoxes.boxId, cargoBoxes.id))
    .leftJoin(
      batchPallets,
      and(
        eq(batchPallets.batchId, batchId),
        eq(batchPallets.palletId, cargoBoxes.palletId),
      ),
    )
    .where(looseBoxCond(batchId));
  const [looseDone] = await db
    .select({ done: count() })
    .from(batchBoxes)
    .innerJoin(cargoBoxes, eq(batchBoxes.boxId, cargoBoxes.id))
    .leftJoin(
      batchPallets,
      and(
        eq(batchPallets.batchId, batchId),
        eq(batchPallets.palletId, cargoBoxes.palletId),
      ),
    )
    .where(and(looseBoxCond(batchId), eq(batchBoxes.unloadedScan, true)));
  const [palTot] = await db
    .select({ total: count() })
    .from(batchPallets)
    .where(
      and(eq(batchPallets.batchId, batchId), eq(batchPallets.loadedScan, true)),
    );
  const [palDone] = await db
    .select({ done: count() })
    .from(batchPallets)
    .where(
      and(
        eq(batchPallets.batchId, batchId),
        eq(batchPallets.unloadedScan, true),
      ),
    );
  return {
    done: Number(looseDone.done) + Number(palDone.done),
    total: Number(looseTot.total) + Number(palTot.total),
  };
}

/**
 * Yashik (paddon) QR/kodi scan qilinganda: yashik BITTA BIRLIK sifatida
 * yuklanadi yoki tushiriladi (ichidagi karobkalar alohida sanalmaydi, lekin
 * jo'natish/tushirishda holat ko'chishi uchun batch_box'ga yoziladi).
 * Kod yashik bo'lmasa null qaytaradi (chaqiruvchi oddiy karobka scaniga o'tadi).
 */
async function applyPalletScan(
  batchId: string,
  code: string,
  mode: "load" | "unload",
  userId: string,
): Promise<ScanResult | null> {
  const pal = await palletBoxIds(code);
  if (!pal) return null; // yashik emas

  // Yashik shu partiyaga rejalashtirilganmi?
  const planned = await db.query.batchPallets.findFirst({
    where: and(
      eq(batchPallets.batchId, batchId),
      eq(batchPallets.palletId, pal.palletId),
    ),
  });

  if (mode === "unload") {
    if (!planned) return { outcome: "extra", code };
    if (!planned.loadedScan) return { outcome: "not_on_plan", code };
    if (planned.unloadedScan) {
      const p = await unloadProgress(batchId);
      return { outcome: "duplicate", code, done: p.done, total: p.total };
    }
    const now = new Date();
    await db.transaction(async (tx) => {
      if (pal.boxIds.length) {
        await tx
          .update(batchBoxes)
          .set({ unloadedScan: true, unloadedAt: now, unloadedBy: userId, flag: null })
          .where(
            and(
              eq(batchBoxes.batchId, batchId),
              inArray(batchBoxes.boxId, pal.boxIds),
              eq(batchBoxes.unloadedScan, false),
            ),
          );
      }
      await tx
        .update(batchPallets)
        .set({ unloadedScan: true, unloadedAt: now, unloadedBy: userId })
        .where(eq(batchPallets.id, planned.id));
    });
    const p = await unloadProgress(batchId);
    return {
      outcome: "unloaded",
      code,
      done: p.done,
      total: p.total,
      label: `📦 ${code} · ${pal.boxIds.length} karobka`,
    };
  }

  // Yuklash
  if (!planned) return { outcome: "not_on_plan", code };
  if (planned.loadedScan) {
    const p = await loadProgress(batchId);
    return { outcome: "duplicate", code, done: p.done, total: p.total };
  }
  if (pal.boxIds.length === 0) return { outcome: "not_on_plan", code };

  const boxes = await db
    .select({ id: cargoBoxes.id, cargoId: cargoBoxes.cargoId })
    .from(cargoBoxes)
    .where(inArray(cargoBoxes.id, pal.boxIds));

  const now = new Date();
  await db.transaction(async (tx) => {
    for (const bx of boxes) {
      await tx
        .insert(batchBoxes)
        .values({
          batchId,
          boxId: bx.id,
          cargoId: bx.cargoId,
          loadedScan: true,
          loadedAt: now,
          loadedBy: userId,
        })
        .onConflictDoNothing();
    }
    await tx
      .update(batchPallets)
      .set({ loadedScan: true, loadedAt: now, loadedBy: userId })
      .where(eq(batchPallets.id, planned.id));
    await tx
      .update(batches)
      .set({ status: "loading", updatedAt: now })
      .where(and(eq(batches.id, batchId), eq(batches.status, "planned")));
  });

  const p = await loadProgress(batchId);
  return {
    outcome: "loaded",
    code,
    done: p.done,
    total: p.total,
    label: `📦 ${code} · ${boxes.length} karobka`,
  };
}

export async function scanLoad(batchId: string, code: string): Promise<ScanResult> {
  const session = await requireAny(["tms.manage", "tms.load"]);
  const b = await db.query.batches.findFirst({ where: eq(batches.id, batchId) });
  if (!b) throw new Error("NOT_FOUND");
  assertWarehouseScope(session, b.originWarehouseId);
  // Yuklash FAQAT plan TASDIQLANGANDAN keyin (status=loading). "planned"
  // holatida menejer hali plan tuzyapti — skladchi skanerlay olmaydi.
  if (b.status !== "loading") {
    return { outcome: "wrong_status", code };
  }

  // Karobkani QR bo'yicha topamiz (tovar/mijoz ma'lumoti bilan):
  const boxRows = await db
    .select({
      boxId: cargoBoxes.id,
      lineId: cargoBoxes.lineId,
      cargoId: cargos.id,
      cargoStatus: cargos.status,
      cargoWh: cargos.currentWarehouseId,
      product: cargoLines.productName,
      letter: cargoLines.letterCode,
      lineBoxCount: cargoLines.boxCount,
      clientCode: clients.code,
    })
    .from(cargoBoxes)
    .innerJoin(cargos, eq(cargoBoxes.cargoId, cargos.id))
    .innerJoin(cargoLines, eq(cargoBoxes.lineId, cargoLines.id))
    .innerJoin(clients, eq(cargos.clientId, clients.id))
    .where(boxCodeCond(code))
    .limit(1);
  const box = boxRows[0];

  if (!box) {
    // Yashik (paddon) QR'i bo'lishi mumkin — ichidagilarni birga yuklaymiz.
    const pal = await applyPalletScan(batchId, code, "load", session.sub);
    if (pal) return pal;
    return { outcome: "unknown", code };
  }

  const label = `${box.clientCode}-${box.letter} · ${box.product}`;

  // Bu tovar planda bormi?
  const pl = await db.query.batchLines.findFirst({
    where: and(eq(batchLines.batchId, batchId), eq(batchLines.lineId, box.lineId)),
  });
  if (!pl) {
    // Planda yo'q tovar: shu skladda, tayyor va bo'sh joyi bo'lsa —
    // "planga qo'shish" taklif qilamiz (joy ortganda shu bilan to'ldiriladi).
    const origin = await db.query.warehouses.findFirst({
      where: eq(warehouses.id, b.originWarehouseId),
    });
    const eligible =
      origin &&
      box.cargoWh === b.originWarehouseId &&
      box.cargoStatus === sourceStatusForOrigin(origin.kind);
    if (eligible) {
      const remaining =
        box.lineBoxCount - ((await plannedInOpenBatches()).get(box.lineId) ?? 0);
      if (remaining > 0) {
        return {
          outcome: "can_add",
          code,
          cargoId: box.cargoId,
          lineId: box.lineId,
          label,
        };
      }
    }
    return { outcome: "not_on_plan", code, label };
  }

  // Kvota nazorati — bir nechta skanner parallel ishlaganda ham aniq bo'lishi
  // uchun plan qatori tranzaksiyada qulflanadi.
  const result = await db.transaction(async (tx): Promise<ScanResult> => {
    await tx
      .select({ id: batchLines.id })
      .from(batchLines)
      .where(eq(batchLines.id, pl.id))
      .for("update");

    const dup = await tx.query.batchBoxes.findFirst({
      where: and(eq(batchBoxes.batchId, batchId), eq(batchBoxes.boxId, box.boxId)),
    });
    if (dup) return { outcome: "duplicate", code, label };

    // Boshqa faol partiyada allaqachon yuklanganmi?
    const other = await tx
      .select({ id: batchBoxes.id })
      .from(batchBoxes)
      .innerJoin(batches, eq(batchBoxes.batchId, batches.id))
      .where(
        and(
          eq(batchBoxes.boxId, box.boxId),
          ne(batchBoxes.batchId, batchId),
          ne(batches.status, "closed"),
        ),
      )
      .limit(1);
    if (other.length) return { outcome: "not_on_plan", code, label };

    const [cnt] = await tx
      .select({ n: count() })
      .from(batchBoxes)
      .innerJoin(cargoBoxes, eq(batchBoxes.boxId, cargoBoxes.id))
      .where(
        and(
          eq(batchBoxes.batchId, batchId),
          eq(cargoBoxes.lineId, box.lineId),
          eq(batchBoxes.loadedScan, true),
        ),
      );
    const scanned = Number(cnt?.n ?? 0);
    if (scanned >= pl.plannedBoxes) {
      // SABAB ko'rsatilgan rad: plan to'ldi — logist sonni oshirsagina o'tadi.
      return {
        outcome: "quota_full",
        code,
        label: `${label} — ${scanned}/${pl.plannedBoxes}`,
      };
    }

    await tx.insert(batchBoxes).values({
      batchId,
      boxId: box.boxId,
      cargoId: box.cargoId,
      loadedScan: true,
      loadedAt: new Date(),
      loadedBy: session.sub,
    });
    await tx
      .update(batches)
      .set({ status: "loading", updatedAt: new Date() })
      .where(and(eq(batches.id, batchId), eq(batches.status, "planned")));
    return {
      outcome: "loaded",
      code,
      label: `${label} · ${scanned + 1}/${pl.plannedBoxes}`,
    };
  });

  const p = await loadProgress(batchId);
  return { ...result, done: p.done, total: p.total };
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
    .where(and(eq(batchBoxes.batchId, batchId), boxCodeCond(code)))
    .limit(1);
  const hit = rows[0];

  if (!hit) {
    // Yashik (paddon) QR'i — ichidagi hamma karobkani birga tushiramiz.
    const pal = await applyPalletScan(batchId, code, "unload", session.sub);
    if (pal) return pal;
    // Manifestda yo'q: ortiqcha (boshqa partiya karobkasi) yoki noma'lum.
    const known = await db.query.cargoBoxes.findFirst({ where: boxCodeCond(code) });
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
export async function departBatch(
  batchId: string,
  opts: { leaveUnscanned?: boolean } = {},
) {
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

  const prog = await loadProgress(batchId);
  if (prog.total === 0) throw new Error("EMPTY_BATCH");
  // Har karobka scan qilingan bo'lishi SHART. Scan qilinmaganlar bo'lsa —
  // faqat ochiq tasdiq bilan (leaveUnscanned): ular skladda QOLADI.
  if (prog.done < prog.total && !opts.leaveUnscanned) {
    throw new Error(`LOAD_INCOMPLETE:${prog.done}:${prog.total}`);
  }
  if (prog.done === 0) throw new Error("NOTHING_SCANNED");

  const leftBehind = prog.total - prog.done;
  await db.transaction(async (tx) => {
    // Mashinada FAQAT batch_box'dagi (scan qilingan) karobkalar bor.
    // Prixodning yuklanmagan karobkalari SKLADDA QOLADI:
    //  - umuman yuklanmagan prixod → plandan chiqadi (skladda o'z holicha);
    //  - qisman yuklangan → bo'linadi: qoldiq alohida prixod (reg-R1).
    const loadedRows: { boxId: string; cargoId: string }[] = await tx
      .select({ boxId: batchBoxes.boxId, cargoId: batchBoxes.cargoId })
      .from(batchBoxes)
      .where(and(eq(batchBoxes.batchId, batchId), eq(batchBoxes.loadedScan, true)));
    const loadedByCargo = new Map<string, Set<string>>();
    for (const r of loadedRows) {
      const s = loadedByCargo.get(r.cargoId) ?? new Set<string>();
      s.add(r.boxId);
      loadedByCargo.set(r.cargoId, s);
    }

    const planCargos: { cargoId: string }[] = await tx
      .select({ cargoId: batchCargos.cargoId })
      .from(batchCargos)
      .where(eq(batchCargos.batchId, batchId));

    for (const { cargoId } of planCargos) {
      const loaded = loadedByCargo.get(cargoId);
      if (!loaded || loaded.size === 0) {
        // Umuman yuklanmagan — plandan chiqadi, skladda qoladi.
        await tx
          .delete(batchLines)
          .where(
            and(eq(batchLines.batchId, batchId), eq(batchLines.cargoId, cargoId)),
          );
        await tx
          .delete(batchCargos)
          .where(
            and(
              eq(batchCargos.batchId, batchId),
              eq(batchCargos.cargoId, cargoId),
            ),
          );
        continue;
      }
      const allBoxes: { id: string }[] = await tx
        .select({ id: cargoBoxes.id })
        .from(cargoBoxes)
        .where(eq(cargoBoxes.cargoId, cargoId));
      if (loaded.size < allBoxes.length) {
        const remainder = allBoxes
          .filter((x) => !loaded.has(x.id))
          .map((x) => x.id);
        await splitCargoRemainder(tx, cargoId, remainder, {
          note: `${b.code} — skladda qolgan qismi`,
          userId: session.sub,
        });
      }
    }

    // Jo'naydigan yuklar (yuklanganlari bor prixodlar).
    const items: { cargoId: string; status: string }[] = await tx
      .select({ cargoId: batchCargos.cargoId, status: cargos.status })
      .from(batchCargos)
      .innerJoin(cargos, eq(batchCargos.cargoId, cargos.id))
      .where(eq(batchCargos.batchId, batchId));
    if (items.length === 0) throw new Error("EMPTY_BATCH");

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
    payload: { code: b.code, leftBehind },
  });
}

/**
 * Scan-to-add: planda yo'q tovar karobkasi scan qilinganda bir bosishda tovar
 * (qator) planga to'liq mavjud soni bilan qo'shilib, karobka darhol yuklanadi.
 */
export async function addLineAndScanLoad(
  batchId: string,
  lineId: string,
  code: string,
): Promise<ScanResult> {
  const line = await db.query.cargoLines.findFirst({
    where: eq(cargoLines.id, lineId),
  });
  if (!line) return { outcome: "unknown", code };
  const available =
    line.boxCount - ((await plannedInOpenBatches(batchId)).get(lineId) ?? 0);
  if (available < 1) return { outcome: "not_on_plan", code };
  await setPlanLine(batchId, lineId, available); // ruxsat/holat/origin tekshiradi
  return scanLoad(batchId, code);
}

// ─── Qo'lda belgilash (stiker tugadi / tushib qoldi) ────────────────────────
// Skaner ishlamaganda ishchi tovarni RO'YXATDAN tanlab bitta karobkani
// "yuklandi/tushirildi" deb belgilaydi — tizim shu qatorning navbatdagi bo'sh
// karobkasini scanLoad/scanUnload orqali qayd etadi (kvota/qoidalar saqlanadi).

/** Skaner ekrani "qo'lda belgilash" paneli uchun: plandagi qatorlar + soni. */
export async function getScanLines(batchId: string) {
  const session = await requirePermission("tms.view");
  const b = await db.query.batches.findFirst({ where: eq(batches.id, batchId) });
  if (!b) return [];
  if (
    session.warehouseId &&
    b.originWarehouseId !== session.warehouseId &&
    b.destinationWarehouseId !== session.warehouseId
  ) {
    return [];
  }
  const planRows = await db
    .select({
      lineId: batchLines.lineId,
      planned: batchLines.plannedBoxes,
      letterCode: cargoLines.letterCode,
      productName: cargoLines.productName,
      clientCode: clients.code,
    })
    .from(batchLines)
    .innerJoin(cargoLines, eq(batchLines.lineId, cargoLines.id))
    .innerJoin(cargos, eq(batchLines.cargoId, cargos.id))
    .innerJoin(clients, eq(cargos.clientId, clients.id))
    .where(eq(batchLines.batchId, batchId))
    .orderBy(asc(clients.code), asc(cargoLines.lineNo));

  // Yashik birligiga kirgan karobkalarni bo'sh (loose) hisobdan chiqaramiz.
  const palIdRows = await db
    .select({ palletId: batchPallets.palletId })
    .from(batchPallets)
    .where(eq(batchPallets.batchId, batchId));
  const batchPalletIdSet = new Set(palIdRows.map((r) => r.palletId));

  const bb = await db
    .select({
      lineId: cargoBoxes.lineId,
      palletId: cargoBoxes.palletId,
      loaded: batchBoxes.loadedScan,
      unloaded: batchBoxes.unloadedScan,
    })
    .from(batchBoxes)
    .innerJoin(cargoBoxes, eq(batchBoxes.boxId, cargoBoxes.id))
    .where(eq(batchBoxes.batchId, batchId));
  const counts = new Map<string, { loaded: number; unloaded: number }>();
  for (const r of bb) {
    if (r.palletId && batchPalletIdSet.has(r.palletId)) continue;
    const c = counts.get(r.lineId) ?? { loaded: 0, unloaded: 0 };
    if (r.loaded) c.loaded += 1;
    if (r.unloaded) c.unloaded += 1;
    counts.set(r.lineId, c);
  }

  const lineItems = planRows.map((r) => {
    const c = counts.get(r.lineId) ?? { loaded: 0, unloaded: 0 };
    return {
      kind: "line" as const,
      id: r.lineId,
      title: `${r.clientCode}-${r.letterCode} · ${r.productName}`,
      planned: r.planned,
      loaded: c.loaded,
      unloaded: c.unloaded,
    };
  });

  // YASHIK birliklari (har biri 1) — manual panelda ham tanlansa bo'ladi.
  const palRows = await db
    .select({
      palletId: batchPallets.palletId,
      code: pallets.code,
      clientCode: clients.code,
      loaded: batchPallets.loadedScan,
      unloaded: batchPallets.unloadedScan,
    })
    .from(batchPallets)
    .innerJoin(pallets, eq(batchPallets.palletId, pallets.id))
    .innerJoin(clients, eq(pallets.clientId, clients.id))
    .where(eq(batchPallets.batchId, batchId))
    .orderBy(asc(pallets.code));
  const palItems = palRows.map((r) => ({
    kind: "pallet" as const,
    id: r.palletId,
    title: `📦 ${r.code} · ${r.clientCode}`,
    planned: 1,
    loaded: r.loaded ? 1 : 0,
    unloaded: r.unloaded ? 1 : 0,
  }));

  return [...lineItems, ...palItems];
}

/** Qo'lda bitta birlikni belgilash: qatorning navbatdagi bo'sh karobkasini
 * yoki YASHIK birligini oddiy scan yo'li bilan qayd etadi (qoidalar saqlanadi). */
export async function manualMark(
  batchId: string,
  id: string,
  mode: "load" | "unload",
  kind: "line" | "pallet" = "line",
): Promise<ScanResult> {
  const session = await requireAny(["tms.load", "tms.manage"]);

  if (kind === "pallet") {
    const pal = await db.query.pallets.findFirst({ where: eq(pallets.id, id) });
    if (!pal) return { outcome: "unknown", code: "" };
    const res = await applyPalletScan(batchId, pal.code, mode, session.sub);
    return res ?? { outcome: "unknown", code: pal.code };
  }

  if (mode === "load") {
    const loaded = await db
      .select({ boxId: batchBoxes.boxId })
      .from(batchBoxes)
      .where(and(eq(batchBoxes.batchId, batchId), eq(batchBoxes.loadedScan, true)));
    const loadedSet = new Set(loaded.map((x) => x.boxId));
    const candidates = await db
      .select({ boxId: cargoBoxes.id, qrCode: cargoBoxes.qrCode })
      .from(cargoBoxes)
      .where(eq(cargoBoxes.lineId, id))
      .orderBy(asc(cargoBoxes.boxNo));
    const pick = candidates.find((c) => !loadedSet.has(c.boxId));
    if (!pick) return { outcome: "quota_full", code: "" };
    return scanLoad(batchId, pick.qrCode);
  }

  // unload: shu qatorning yuklangan, lekin hali tushirilmagan karobkasi
  const pick = await db
    .select({ qrCode: cargoBoxes.qrCode })
    .from(batchBoxes)
    .innerJoin(cargoBoxes, eq(batchBoxes.boxId, cargoBoxes.id))
    .where(
      and(
        eq(batchBoxes.batchId, batchId),
        eq(cargoBoxes.lineId, id),
        eq(batchBoxes.loadedScan, true),
        eq(batchBoxes.unloadedScan, false),
      ),
    )
    .orderBy(asc(cargoBoxes.boxNo))
    .limit(1);
  if (!pick[0]) return { outcome: "duplicate", code: "" };
  return scanUnload(batchId, pick[0].qrCode);
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
