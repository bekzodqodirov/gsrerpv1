// Yuk servisi: ko'p qatorli qabul, karobka QR kodlari, ro'yxat, tafsilot.
// Sklad xodimi (session.warehouseId bor) faqat o'z skladida ishlaydi.
import { and, asc, desc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
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
  batchCargos,
  batches,
} from "@/db/schema";
import { requirePermission } from "@/modules/shared/auth";
import { nextNumber } from "@/modules/shared/numbering";
import { RESTING_STATUSES } from "@/modules/stock/dto";
import { letterCodeForIndex, buildBoxQr, nextLetterSeqs } from "./box-code";
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
 * Har xil tovar — alohida qator, o'z harf kodi bilan: A, B, C... Shu tovarning
 * BARCHA karobkalari bir xil kodni oladi: GS1-GSR0002-A (sklad, mijoz, harf).
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

    // Harflar mijozning uzluksiz ketma-ketligidan ajratiladi (A,B,C → D,E...).
    const letterSeqs = await allocateClientLetters(
      tx,
      client.id,
      data.lines.length,
    );
    await insertLinesAndBoxes(tx, c.id, regNumber, data.lines, lineTotals, letterSeqs);

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
    // Mavjud harf-tartiblarni saqlaymiz — tahrirda harflar siljib ketmasin.
    // Mijoz o'zgarmagan bo'lsa qayta ishlatamiz; o'zgargan bo'lsa yangi
    // mijozdan yangi harflar ajratamiz (eskilari eski mijozda qoladi).
    const oldLines = await tx.query.cargoLines.findMany({
      where: eq(cargoLines.cargoId, cargoId),
      orderBy: asc(cargoLines.lineNo),
      columns: { letterSeq: true },
    });
    const reuse =
      existing.clientId === client.id ? oldLines.map((l) => l.letterSeq) : [];

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

    const letterSeqs = await allocateClientLetters(
      tx,
      client.id,
      data.lines.length,
      reuse,
    );
    await insertLinesAndBoxes(tx, c.id, c.regNumber, data.lines, lineTotals, letterSeqs);

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

/**
 * Mijozning uzluksiz harf ketma-ketligidan `count` ta tartib ajratadi.
 * `reuse` — tahrirda saqlanadigan eski tartiblar (birinchi navbatda ular
 * ishlatiladi); yetmagani mijoz hisoblagichidan (client.lastLetterSeq) olinadi
 * va hisoblagich shuncha oshiriladi. Natija — qatorlar tartibida absolyut
 * 0-based indekslar massivi.
 */
async function allocateClientLetters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  clientId: string,
  count: number,
  reuse: number[] = [],
): Promise<number[]> {
  const reuseSorted = [...reuse].sort((a, b) => a - b).slice(0, count);
  const extra = count - reuseSorted.length;

  // Yangi harflar kerak bo'lsa — hisoblagichni ATOMAR oshiramiz (poyga bo'lmasin)
  // va oldingi qiymatdan (freshBase) davom ettiramiz. Sof math nextLetterSeqs'da.
  let freshBase = 0;
  if (extra > 0) {
    const [row] = await tx
      .update(clients)
      .set({ lastLetterSeq: sql`${clients.lastLetterSeq} + ${extra}` })
      .where(eq(clients.id, clientId))
      .returning({ last: clients.lastLetterSeq });
    freshBase = Number(row.last) - extra;
  }
  return nextLetterSeqs(freshBase, count, reuseSorted).seqs;
}

async function insertLinesAndBoxes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  cargoId: string,
  regNumber: string,
  lines: ReceiveCargoInput["lines"],
  lineTotals: ReturnType<typeof computeLineTotals>[],
  letterSeqs: number[],
) {
  let boxNo = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const totals = lineTotals[i];
    // Harf — mijoz bo'yicha uzluksiz tartibdan (guruhlash uchun, inson o'qiydi).
    const letterSeq = letterSeqs[i];
    const letterCode = letterCodeForIndex(letterSeq);

    const [line] = await tx
      .insert(cargoLines)
      .values({
        cargoId,
        lineNo: i + 1,
        letterSeq,
        letterCode,
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

    // Har karobka — o'z UNIKAL QR kodi bilan (scan qilish uchun).
    const boxRows = Array.from({ length: l.boxCount }, () => {
      boxNo += 1;
      return {
        cargoId,
        lineId: line.id,
        boxNo,
        qrCode: buildBoxQr(regNumber, boxNo),
      };
    });
    for (let j = 0; j < boxRows.length; j += 500) {
      await tx.insert(cargoBoxes).values(boxRows.slice(j, j + 500));
    }
  }
}

/**
 * Yuklar ro'yxati: sklad xodimiga faqat o'z skladi ko'rinadi.
 * Har prixodga qatorlari (kengaytiriladigan qator uchun), qator rasmi va
 * umumiy prixod rasmi (agar biriktirilgan bo'lsa) qo'shib qaytariladi.
 */
export async function listCargos(filter: CargoListFilter = {}) {
  const session = await requirePermission("cargo.view");

  const conds = [eq(cargos.voided, false)];
  if (session.warehouseId) {
    conds.push(eq(cargos.currentWarehouseId, session.warehouseId));
  }
  if (filter.status) {
    conds.push(eq(cargos.status, filter.status));
  } else {
    // Qaytarilgan yuklar UMUMIY ro'yxatda ko'rinmaydi — ular alohida
    // "Qaytarilganlar" ro'yxatida (status='returned' bilan so'ralganda).
    conds.push(ne(cargos.status, "returned"));
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
      warehouseGsCode: warehouses.gsCode,
    })
    .from(cargos)
    .innerJoin(clients, eq(cargos.clientId, clients.id))
    .leftJoin(warehouses, eq(cargos.currentWarehouseId, warehouses.id))
    .where(and(...conds))
    .orderBy(desc(cargos.createdAt))
    .limit(200);

  const cargoIds = rows.map((r) => r.id);
  const [lineRows, cargoFileRows] = await Promise.all([
    cargoIds.length
      ? db
          .select({
            cargoId: cargoLines.cargoId,
            id: cargoLines.id,
            lineNo: cargoLines.lineNo,
            letterCode: cargoLines.letterCode,
            productName: cargoLines.productName,
            boxCount: cargoLines.boxCount,
            boxLengthCm: cargoLines.boxLengthCm,
            boxWidthCm: cargoLines.boxWidthCm,
            boxHeightCm: cargoLines.boxHeightCm,
            weightPerBoxKg: cargoLines.weightPerBoxKg,
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
            fileName: attachments.fileName,
            mimeType: attachments.mimeType,
            sizeBytes: attachments.sizeBytes,
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

  // Har qatorning birinchi rasmi — bitta so'rovda (N+1'dan qochish)
  const lineIds = lineRows.map((l) => l.id);
  const linePhotoRows = lineIds.length
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
  for (const p of linePhotoRows) {
    if (p.mimeType.startsWith("image/") && !photoByLine.has(p.entityId)) {
      photoByLine.set(p.entityId, p.id);
    }
  }

  // Yuk QAYSI partiyada ketyapti (ochiq/faol partiya) — ro'yxatda ko'rsatiladi.
  const batchRows = cargoIds.length
    ? await db
        .select({
          cargoId: batchCargos.cargoId,
          batchId: batches.id,
          code: batches.code,
          status: batches.status,
        })
        .from(batchCargos)
        .innerJoin(batches, eq(batchCargos.batchId, batches.id))
        .where(
          and(
            inArray(batchCargos.cargoId, cargoIds),
            inArray(batches.status, ["planned", "loading", "departed", "arrived"]),
          ),
        )
    : [];
  const batchByCargo = new Map<
    string,
    { batchId: string; code: string; status: string }
  >();
  for (const b of batchRows) {
    // Bir yuk bir vaqtda faqat bitta ochiq partiyada bo'ladi — birinchisi yetarli.
    if (!batchByCargo.has(b.cargoId)) {
      batchByCargo.set(b.cargoId, { batchId: b.batchId, code: b.code, status: b.status });
    }
  }

  const linesByCargo = new Map<
    string,
    Array<(typeof lineRows)[number] & { photoId: string | null }>
  >();
  for (const l of lineRows) {
    const arr = linesByCargo.get(l.cargoId) ?? [];
    arr.push({ ...l, photoId: photoByLine.get(l.id) ?? null });
    linesByCargo.set(l.cargoId, arr);
  }

  const filesByCargo = new Map<
    string,
    Array<{ id: string; fileName: string; sizeBytes: number }>
  >();
  const firstPhotoByCargo = new Map<string, string>();
  for (const f of cargoFileRows) {
    const arr = filesByCargo.get(f.entityId) ?? [];
    arr.push({ id: f.id, fileName: f.fileName, sizeBytes: f.sizeBytes });
    filesByCargo.set(f.entityId, arr);
    if (f.mimeType.startsWith("image/") && !firstPhotoByCargo.has(f.entityId)) {
      firstPhotoByCargo.set(f.entityId, f.id);
    }
  }

  return rows.map((r) => ({
    ...r,
    lines: linesByCargo.get(r.id) ?? [],
    photoId: firstPhotoByCargo.get(r.id) ?? null,
    files: filesByCargo.get(r.id) ?? [],
    batch: batchByCargo.get(r.id) ?? null,
  }));
}

/** Prixod tafsiloti: qatorlar bilan. Sklad cheklovi bu yerda ham amal qiladi. */
export async function getCargo(id: string) {
  const session = await requirePermission("cargo.view");

  const originWh = alias(warehouses, "origin_wh");
  const rows = await db
    .select({
      cargo: cargos,
      clientCode: clients.code,
      clientName: clients.name,
      warehouseCode: warehouses.code,
      warehouseName: warehouses.name,
      warehouseGsCode: warehouses.gsCode,
      // Yuk QAYSI skladdan kelgani (yorliqda ko'rsatiladi) — qabul qilingan sklad:
      originCode: originWh.code,
      originName: originWh.name,
      originGsCode: originWh.gsCode,
    })
    .from(cargos)
    .innerJoin(clients, eq(cargos.clientId, clients.id))
    .leftJoin(warehouses, eq(cargos.currentWarehouseId, warehouses.id))
    .leftJoin(originWh, eq(cargos.originWarehouseId, originWh.id))
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

/** Bitta tovar (qator) uchun QR — "QR ko'rish" popover uchun. */
export async function getLineQr(lineId: string) {
  await requirePermission("cargo.view");
  const line = await db.query.cargoLines.findFirst({
    where: eq(cargoLines.id, lineId),
  });
  if (!line) return null;
  const box = await db.query.cargoBoxes.findFirst({
    where: eq(cargoBoxes.lineId, lineId),
  });
  return {
    qrCode: box?.qrCode ?? null,
    letterCode: line.letterCode,
    boxCount: line.boxCount,
  };
}

/** QR yorliqlar uchun: prixodning barcha karobkalari, to'liq ma'lumot bilan. */
export async function getCargoBoxes(cargoId: string) {
  await requirePermission("cargo.view");
  const boxes = await db
    .select({
      lineId: cargoBoxes.lineId,
      boxNo: cargoBoxes.boxNo,
      qrCode: cargoBoxes.qrCode,
      boxUid: cargoBoxes.boxUid,
      letterCode: cargoLines.letterCode,
      productName: cargoLines.productName,
      boxCount: cargoLines.boxCount,
    })
    .from(cargoBoxes)
    .innerJoin(cargoLines, eq(cargoBoxes.lineId, cargoLines.id))
    .where(eq(cargoBoxes.cargoId, cargoId))
    .orderBy(asc(cargoBoxes.boxNo));

  // Har karobkaning o'z qatori ichidagi tartib raqami: "nechinchi/nechtadan"
  const seenInLine = new Map<string, number>();
  return boxes.map((b) => {
    const position = (seenInLine.get(b.lineId) ?? 0) + 1;
    seenInLine.set(b.lineId, position);
    return { ...b, position };
  });
}

/**
 * Yukni QAYTARISH: omborga kelib bo'lgan (jismonan turgan) yukni "qaytarildi"
 * deb belgilaydi. Status RESTING_STATUSES ga kirmagani uchun yuk qoldiqdan
 * o'z-o'zidan chiqadi. Sabab cargo_event'ga yoziladi (tarix uchun).
 */
export async function returnCargo(cargoId: string, reason: string) {
  const session = await requirePermission("cargo.move");
  const cargo = await db.query.cargos.findFirst({
    where: eq(cargos.id, cargoId),
  });
  if (!cargo || cargo.voided) throw new Error("NOT_FOUND");
  // Sklad xodimi faqat o'z omboridagini qaytaradi.
  if (session.warehouseId && cargo.currentWarehouseId !== session.warehouseId) {
    throw new Error("NOT_HERE");
  }
  // Faqat omborda jismonan turgan yukni qaytarish mumkin.
  if (!(RESTING_STATUSES as readonly string[]).includes(cargo.status)) {
    throw new Error("NOT_RETURNABLE");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(cargos)
      .set({ status: "returned", updatedAt: new Date() })
      .where(eq(cargos.id, cargoId));
    await tx.insert(cargoEvents).values({
      cargoId,
      type: "status_change",
      fromStatus: cargo.status,
      toStatus: "returned",
      comment: reason.trim() || null,
      userId: session.sub,
    });
  });
  return { id: cargoId };
}

/**
 * Qaytarilgan yukni SAQLANGAN joyidan (returned) butunlay o'chirish.
 * O'chirish = voided (yumshoq o'chirish): barcha ro'yxatlardan yo'qoladi,
 * lekin tarix (audit/event) saqlanadi. Faqat 'returned' holatidagi yuk uchun.
 */
export async function deleteReturnedCargo(cargoId: string) {
  const session = await requirePermission("cargo.move");
  const cargo = await db.query.cargos.findFirst({
    where: eq(cargos.id, cargoId),
  });
  if (!cargo || cargo.voided) throw new Error("NOT_FOUND");
  if (cargo.status !== "returned") throw new Error("NOT_RETURNED");
  if (session.warehouseId && cargo.currentWarehouseId !== session.warehouseId) {
    throw new Error("NOT_HERE");
  }
  await db.transaction(async (tx) => {
    await tx
      .update(cargos)
      .set({ voided: true, updatedAt: new Date() })
      .where(eq(cargos.id, cargoId));
    await tx.insert(cargoEvents).values({
      cargoId,
      type: "note",
      comment: "returned cargo permanently removed",
      userId: session.sub,
    });
  });
  return { id: cargoId };
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
