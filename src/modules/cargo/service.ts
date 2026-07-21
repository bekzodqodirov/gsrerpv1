// Yuk servisi: ko'p qatorli qabul, karobka QR kodlari, ro'yxat, tafsilot.
// Sklad xodimi (session.warehouseId bor) faqat o'z skladida ishlaydi.
import { and, asc, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import {
  cargos,
  cargoLines,
  cargoBoxes,
  cargoEvents,
  clients,
  warehouses,
  auditLog,
} from "@/db/schema";
import { requirePermission } from "@/modules/shared/auth";
import { nextNumber } from "@/modules/shared/numbering";
import {
  receiveCargoSchema,
  computeLineTotals,
  type ReceiveCargoInput,
  type CargoListFilter,
} from "./dto";

/**
 * Yuk qabul qilish (Xitoy skladida).
 * Har xil tovar — alohida qator; har karobkaga unique QR kod:
 * YK-2026-00001-B001, -B002, ...
 */
export async function receiveCargo(input: ReceiveCargoInput) {
  const session = await requirePermission("cargo.receive");
  const data = receiveCargoSchema.parse(input);

  const warehouseId = session.warehouseId || data.originWarehouseId;
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

  // Jamlar
  const lineTotals = data.lines.map(computeLineTotals);
  const totalBoxes = data.lines.reduce((s, l) => s + l.boxCount, 0);
  const totalWeightKg = lineTotals.reduce((s, t) => s + t.totalWeightKg, 0);
  const totalVolumeM3 = lineTotals.reduce((s, t) => s + t.totalVolumeM3, 0);

  const regNumber = await nextNumber("cargo", { year: true, pad: 5 });

  // Hammasi bitta tranzaksiyada: prixod + qatorlar + karobkalar
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

    let boxNo = 0;
    for (let i = 0; i < data.lines.length; i++) {
      const l = data.lines[i];
      const totals = lineTotals[i];
      const [line] = await tx
        .insert(cargoLines)
        .values({
          cargoId: c.id,
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

      // Har karobkaga QR kod: YK-2026-00001-B001
      const boxRows = Array.from({ length: l.boxCount }, () => {
        boxNo += 1;
        return {
          cargoId: c.id,
          lineId: line.id,
          boxNo,
          qrCode: `${regNumber}-B${String(boxNo).padStart(3, "0")}`,
        };
      });
      // Katta partiyalarda bo'lib kiritamiz (parametr limitidan qochish)
      for (let j = 0; j < boxRows.length; j += 500) {
        await tx.insert(cargoBoxes).values(boxRows.slice(j, j + 500));
      }
    }

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

/** Yuklar ro'yxati: sklad xodimiga faqat o'z skladi ko'rinadi. */
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

  return db
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

/** QR yorliqlar uchun: prixodning barcha karobkalari. */
export async function getCargoBoxes(cargoId: string) {
  await requirePermission("cargo.view");
  return db
    .select({
      boxNo: cargoBoxes.boxNo,
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
