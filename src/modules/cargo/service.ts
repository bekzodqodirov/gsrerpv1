// Yuk servisi: ko'p qatorli qabul, karobka QR kodlari, ro'yxat, tafsilot.
// Sklad xodimi (session.warehouseId bor) faqat o'z skladida ishlaydi.
import { and, asc, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import {
  cargos,
  cargoLines,
  cargoBoxes,
  cargoEvents,
  clients,
  warehouses,
  auditLog,
  attachments,
} from "@/db/schema";
import { requirePermission } from "@/modules/shared/auth";
import { nextNumber } from "@/modules/shared/numbering";
import { letterCodeForIndex, buildBoxCode } from "./box-code";
import {
  receiveCargoSchema,
  computeLineTotals,
  type ReceiveCargoInput,
  type CargoListFilter,
} from "./dto";

/** Qabul qilinayotgan mijoz/sklad/qatorlarni tekshiradi (create va update umumiy). */
async function resolveReceiveContext(
  sessionWarehouseId: string | null,
  data: ReceiveCargoInput,
) {
  const warehouseId = sessionWarehouseId || data.originWarehouseId;
  if (!warehouseId) throw new Error("WAREHOUSE_REQUIRED");

  const wh = await db.query.warehouses.findFirst({
    where: eq(warehouses.id, warehouseId),
  });
  if (!wh || !wh.isActive) throw new Error("WAREHOUSE_NOT_FOUND");
  if (wh.country !== "CN") throw new Error("WAREHOUSE_NOT_RECEIVING");

  const client = await db.query.clients.findFirst({
    where: eq(clients.id, data.clientId),
  });
  if (!client || !client.isActive) throw new Error("CLIENT_NOT_FOUND");

  return { wh, client };
}

/**
 * Yuk qabul qilish (Xitoy skladida).
 * Har xil tovar — alohida qator; har karobkaga yorliq kodi:
 * GS1-GSR0002-A, -B, -C... (sklad GS-kodi, mijoz kodi, davriy harf).
 */
export async function receiveCargo(input: ReceiveCargoInput) {
  const session = await requirePermission("cargo.receive");
  const data = receiveCargoSchema.parse(input);
  const { wh, client } = await resolveReceiveContext(
    session.warehouseId,
    data,
  );

  const lineTotals = data.lines.map(computeLineTotals);
  const totalBoxes = data.lines.reduce((s, l) => s + l.boxCount, 0);
  const totalWeightKg = lineTotals.reduce((s, t) => s + t.totalWeightKg, 0);
  const totalVolumeM3 = lineTotals.reduce((s, t) => s + t.totalVolumeM3, 0);

  const regNumber = await nextNumber("cargo", { year: true, pad: 5 });

  const cargo = await db.transaction(async (tx) => {
    const [c] = await tx
      .insert(cargos)
      .values({
        regNumber,
        clientId: client.id,
        originWarehouseId: wh.id,
        currentWarehouseId: wh.id,
        totalBoxes,
        totalWeightKg: String(Math.round(totalWeightKg * 1000) / 1000),
        totalVolumeM3: String(Math.round(totalVolumeM3 * 10000) / 10000),
        status: "received_cn",
        receivedAt: new Date(),
        note: data.note || null,
        createdBy: session.sub,
      })
      .returning();

    await insertLinesAndBoxes(tx, c.id, data.lines, lineTotals, wh.gsCode, client.code);

    await tx.insert(cargoEvents).values({
      cargoId: c.id,
      type: "status_change",
      toStatus: "received_cn",
      data: { warehouse: wh.code, boxes: totalBoxes, lines: data.lines.length },
      userId: session.sub,
    });

    return c;
  });

  await db.insert(auditLog).values({
    userId: session.sub,
    action: "create",
    entity: "cargo",
    entityId: cargo.id,
    payload: { regNumber, client: client.code, warehouse: wh.code, totalBoxes },
  });

  return cargo;
}

/**
 * Prixodni tahrirlash — sklad xodimi noto'g'ri kiritganda tuzatish uchun.
 * Faqat "received_cn" holatida (hali harakatlanmagan) ruxsat etiladi.
 * Qatorlar va karobkalar qayta yaratiladi (harf kodlari qaytadan hisoblanadi).
 */
export async function updateCargo(cargoId: string, input: ReceiveCargoInput) {
  const session = await requirePermission("cargo.receive");
  const data = receiveCargoSchema.parse(input);

  const existing = await db.query.cargos.findFirst({
    where: eq(cargos.id, cargoId),
  });
  if (!existing) throw new Error("NOT_FOUND");
  if (
    session.warehouseId &&
    existing.currentWarehouseId !== session.warehouseId
  ) {
    throw new Error("NOT_FOUND");
  }
  if (existing.status !== "received_cn") throw new Error("CARGO_LOCKED");

  const { wh, client } = await resolveReceiveContext(
    session.warehouseId,
    data,
  );

  const lineTotals = data.lines.map(computeLineTotals);
  const totalBoxes = data.lines.reduce((s, l) => s + l.boxCount, 0);
  const totalWeightKg = lineTotals.reduce((s, t) => s + t.totalWeightKg, 0);
  const totalVolumeM3 = lineTotals.reduce((s, t) => s + t.totalVolumeM3, 0);

  const cargo = await db.transaction(async (tx) => {
    await tx.delete(cargoBoxes).where(eq(cargoBoxes.cargoId, cargoId));
    await tx.delete(cargoLines).where(eq(cargoLines.cargoId, cargoId));

    const [c] = await tx
      .update(cargos)
      .set({
        clientId: client.id,
        originWarehouseId: wh.id,
        currentWarehouseId: wh.id,
        totalBoxes,
        totalWeightKg: String(Math.round(totalWeightKg * 1000) / 1000),
        totalVolumeM3: String(Math.round(totalVolumeM3 * 10000) / 10000),
        note: data.note || null,
        updatedAt: new Date(),
      })
      .where(eq(cargos.id, cargoId))
      .returning();

    await insertLinesAndBoxes(tx, c.id, data.lines, lineTotals, wh.gsCode, client.code);

    await tx.insert(cargoEvents).values({
      cargoId: c.id,
      type: "edit",
      data: { warehouse: wh.code, boxes: totalBoxes, lines: data.lines.length },
      userId: session.sub,
    });

    return c;
  });

  await db.insert(auditLog).values({
    userId: session.sub,
    action: "update",
    entity: "cargo",
    entityId: cargo.id,
    payload: { regNumber: cargo.regNumber, client: client.code, totalBoxes },
  });

  return cargo;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function insertLinesAndBoxes(
  tx: any,
  cargoId: string,
  lines: ReceiveCargoInput["lines"],
  lineTotals: ReturnType<typeof computeLineTotals>[],
  gsCode: string,
  clientCode: string,
) {
  let boxNo = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const totals = lineTotals[i];
    const [line] = await tx
      .insert(cargoLines)
      .values({
        cargoId,
        lineNo: i + 1,
        productName: l.productName,
        boxCount: l.boxCount,
        boxLengthCm: l.boxLengthCm != null ? String(l.boxLengthCm) : null,
        boxWidthCm: l.boxWidthCm != null ? String(l.boxWidthCm) : null,
        boxHeightCm: l.boxHeightCm != null ? String(l.boxHeightCm) : null,
        weightPerBoxKg:
          l.weightPerBoxKg != null ? String(l.weightPerBoxKg) : null,
        totalWeightKg: String(totals.totalWeightKg),
        totalVolumeM3: String(totals.totalVolumeM3),
        note: l.note || null,
      })
      .returning();

    const boxRows = Array.from({ length: l.boxCount }, () => {
      const letter = letterCodeForIndex(boxNo);
      boxNo += 1;
      return {
        cargoId,
        lineId: line.id,
        boxNo,
        letterCode: letter,
        qrCode: buildBoxCode(gsCode, clientCode, letter),
      };
    });
    for (let j = 0; j < boxRows.length; j += 500) {
      await tx.insert(cargoBoxes).values(boxRows.slice(j, j + 500));
    }
  }
}

/**
 * Yuklar ro'yxati: sklad xodimiga faqat o'z skladi ko'rinadi.
 * Har prixodga qatorlari (kengaytiriladigan qator uchun) va umumiy
 * rasmi (agar biriktirilgan bo'lsa) qo'shib qaytariladi.
 */
export async function listCargos(filter: CargoListFilter = {}) {
  const session = await requirePermission("cargo.view");

  const conds = [eq(cargos.voided, false)];
  if (session.warehouseId) {
    conds.push(eq(cargos.currentWarehouseId, session.warehouseId));
  }
  if (filter.status) {
    conds.push(eq(cargos.status, filter.status));
  }
  if (filter.q) {
    const q = `%${filter.q}%`;
    conds.push(
      or(
        ilike(cargos.regNumber, q),
        ilike(clients.code, q),
        ilike(clients.name, q),
      )!,
    );
  }

  const rows = await db
    .select({
      id: cargos.id,
      regNumber: cargos.regNumber,
      status: cargos.status,
      totalBoxes: cargos.totalBoxes,
      totalWeightKg: cargos.totalWeightKg,
      totalVolumeM3: cargos.totalVolumeM3,
      receivedAt: cargos.receivedAt,
      clientCode: clients.code,
      clientName: clients.name,
      warehouseCode: warehouses.code,
    })
    .from(cargos)
    .innerJoin(clients, eq(cargos.clientId, clients.id))
    .leftJoin(warehouses, eq(cargos.currentWarehouseId, warehouses.id))
    .where(and(...conds))
    .orderBy(desc(cargos.createdAt))
    .limit(200);

  const cargoIds = rows.map((r) => r.id);
  const [lineRows, photoRows] = await Promise.all([
    cargoIds.length
      ? db
          .select({
            cargoId: cargoLines.cargoId,
            id: cargoLines.id,
            lineNo: cargoLines.lineNo,
            productName: cargoLines.productName,
            boxCount: cargoLines.boxCount,
            totalWeightKg: cargoLines.totalWeightKg,
            totalVolumeM3: cargoLines.totalVolumeM3,
          })
          .from(cargoLines)
          .where(inArray(cargoLines.cargoId, cargoIds))
          .orderBy(asc(cargoLines.lineNo))
      : [],
    cargoIds.length
      ? db
          .select({
            entityId: attachments.entityId,
            id: attachments.id,
            mimeType: attachments.mimeType,
          })
          .from(attachments)
          .where(
            and(
              eq(attachments.entity, "cargo"),
              inArray(attachments.entityId, cargoIds),
            ),
          )
          .orderBy(asc(attachments.createdAt))
      : [],
  ]);

  const linesByCargo = new Map<string, typeof lineRows>();
  for (const l of lineRows) {
    const arr = linesByCargo.get(l.cargoId) ?? [];
    arr.push(l);
    linesByCargo.set(l.cargoId, arr);
  }
  const photoByCargo = new Map<string, string>();
  for (const p of photoRows) {
    if (p.mimeType.startsWith("image/") && !photoByCargo.has(p.entityId)) {
      photoByCargo.set(p.entityId, p.id);
    }
  }

  return rows.map((r) => ({
    ...r,
    lines: linesByCargo.get(r.id) ?? [],
    photoId: photoByCargo.get(r.id) ?? null,
  }));
}

/** Prixod tafsiloti: qatorlar bilan. Sklad cheklovi bu yerda ham amal qiladi. */
export async function getCargo(id: string) {
  const session = await requirePermission("cargo.view");

  const rows = await db
    .select({
      cargo: cargos,
      clientCode: clients.code,
      clientName: clients.name,
      warehouseCode: warehouses.code,
      warehouseName: warehouses.name,
    })
    .from(cargos)
    .innerJoin(clients, eq(cargos.clientId, clients.id))
    .leftJoin(warehouses, eq(cargos.currentWarehouseId, warehouses.id))
    .where(eq(cargos.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (
    session.warehouseId &&
    row.cargo.currentWarehouseId !== session.warehouseId
  ) {
    return null;
  }

  const lines = await db.query.cargoLines.findMany({
    where: eq(cargoLines.cargoId, id),
    orderBy: asc(cargoLines.lineNo),
  });

  return { ...row, lines };
}

/**
 * Tovarlar ro'yxati (qatorlar), prixod bo'yicha guruhlash uchun mo'ljallangan:
 * bir xil regNumber ostidagi qatorlar ketma-ket keladi, har biriga birinchi
 * rasm va QR kod diapazoni (birinchi..oxirgi harf) biriktirib qaytariladi.
 */
export async function listCargoLines(filter: CargoListFilter = {}) {
  const session = await requirePermission("cargo.view");

  const conds = [eq(cargos.voided, false)];
  if (session.warehouseId) {
    conds.push(eq(cargos.currentWarehouseId, session.warehouseId));
  }
  if (filter.status) {
    conds.push(eq(cargos.status, filter.status));
  }
  if (filter.q) {
    const q = `%${filter.q}%`;
    conds.push(
      or(
        ilike(cargos.regNumber, q),
        ilike(clients.code, q),
        ilike(clients.name, q),
        ilike(cargoLines.productName, q),
      )!,
    );
  }

  const rows = await db
    .select({
      cargoId: cargos.id,
      regNumber: cargos.regNumber,
      status: cargos.status,
      receivedAt: cargos.receivedAt,
      clientCode: clients.code,
      clientName: clients.name,
      lineId: cargoLines.id,
      lineNo: cargoLines.lineNo,
      productName: cargoLines.productName,
      boxCount: cargoLines.boxCount,
      totalWeightKg: cargoLines.totalWeightKg,
      totalVolumeM3: cargoLines.totalVolumeM3,
    })
    .from(cargoLines)
    .innerJoin(cargos, eq(cargoLines.cargoId, cargos.id))
    .innerJoin(clients, eq(cargos.clientId, clients.id))
    .where(and(...conds))
    .orderBy(desc(cargos.createdAt), asc(cargoLines.lineNo))
    .limit(500);

  const lineIds = rows.map((r) => r.lineId);
  const [photoRows, boxRows] = await Promise.all([
    lineIds.length
      ? db
          .select({ entityId: attachments.entityId, id: attachments.id })
          .from(attachments)
          .where(
            and(
              eq(attachments.entity, "cargo_line"),
              inArray(attachments.entityId, lineIds),
            ),
          )
          .orderBy(asc(attachments.createdAt))
      : [],
    lineIds.length
      ? db
          .select({
            lineId: cargoBoxes.lineId,
            boxNo: cargoBoxes.boxNo,
            qrCode: cargoBoxes.qrCode,
          })
          .from(cargoBoxes)
          .where(inArray(cargoBoxes.lineId, lineIds))
          .orderBy(asc(cargoBoxes.boxNo))
      : [],
  ]);

  const firstPhotoByLine = new Map<string, string>();
  for (const p of photoRows) {
    if (!firstPhotoByLine.has(p.entityId)) {
      firstPhotoByLine.set(p.entityId, p.id);
    }
  }
  const firstQrByLine = new Map<string, string>();
  const lastQrByLine = new Map<string, string>();
  for (const b of boxRows) {
    if (!firstQrByLine.has(b.lineId)) firstQrByLine.set(b.lineId, b.qrCode);
    lastQrByLine.set(b.lineId, b.qrCode);
  }

  return rows.map((r) => ({
    ...r,
    photoId: firstPhotoByLine.get(r.lineId) ?? null,
    qrFirst: firstQrByLine.get(r.lineId) ?? null,
    qrLast: lastQrByLine.get(r.lineId) ?? null,
  }));
}

/** QR yorliqlar uchun: prixodning barcha karobkalari, to'liq ma'lumot bilan. */
export async function getCargoBoxes(cargoId: string) {
  await requirePermission("cargo.view");
  return db
    .select({
      lineId: cargoBoxes.lineId,
      boxNo: cargoBoxes.boxNo,
      letterCode: cargoBoxes.letterCode,
      qrCode: cargoBoxes.qrCode,
      productName: cargoLines.productName,
    })
    .from(cargoBoxes)
    .innerJoin(cargoLines, eq(cargoBoxes.lineId, cargoLines.id))
    .where(eq(cargoBoxes.cargoId, cargoId))
    .orderBy(asc(cargoBoxes.boxNo));
}

/** Forma uchun: faol mijozlar va qabul qiluvchi skladlar. */
export async function getReceiveFormData() {
  await requirePermission("cargo.receive");
  const [clientList, warehouseList] = await Promise.all([
    db.query.clients.findMany({
      where: eq(clients.isActive, true),
      orderBy: clients.code,
      columns: { id: true, code: true, name: true },
    }),
    db.query.warehouses.findMany({
      where: and(eq(warehouses.isActive, true), eq(warehouses.country, "CN")),
      orderBy: warehouses.code,
      columns: { id: true, code: true, name: true },
    }),
  ]);
  return { clients: clientList, warehouses: warehouseList };
}
