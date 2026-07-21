// Yuk servisi: qabul qilish va ro'yxat.
// Sklad xodimi (session.warehouseId bor) faqat o'z skladida ishlaydi —
// bu qoida UI'da emas, shu yerda majburlanadi.
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import {
  cargos,
  cargoEvents,
  clients,
  warehouses,
  auditLog,
} from "@/db/schema";
import { requirePermission } from "@/modules/shared/auth";
import { nextNumber } from "@/modules/shared/numbering";
import {
  receiveCargoSchema,
  type ReceiveCargoInput,
  type CargoListFilter,
} from "./dto";

/** Yuk qabul qilish (Xitoy skladida). YK-2026-00001 raqami bilan ochiladi. */
export async function receiveCargo(input: ReceiveCargoInput) {
  const session = await requirePermission("cargo.receive");
  const data = receiveCargoSchema.parse(input);

  // Sklad: xodim biriktirilgan bo'lsa — faqat o'zi, aks holda formadan
  const warehouseId = session.warehouseId || data.originWarehouseId;
  if (!warehouseId) throw new Error("WAREHOUSE_REQUIRED");

  const wh = await db.query.warehouses.findFirst({
    where: eq(warehouses.id, warehouseId),
  });
  if (!wh || !wh.isActive) throw new Error("WAREHOUSE_NOT_FOUND");
  // Yuk faqat Xitoy skladlarida qabul qilinadi (Qashqar ham to'g'ridan-to'g'ri oladi)
  if (wh.country !== "CN") throw new Error("WAREHOUSE_NOT_RECEIVING");

  const client = await db.query.clients.findFirst({
    where: eq(clients.id, data.clientId),
  });
  if (!client || !client.isActive) throw new Error("CLIENT_NOT_FOUND");

  const regNumber = await nextNumber("cargo", { year: true, pad: 5 });

  const [cargo] = await db
    .insert(cargos)
    .values({
      regNumber,
      clientId: client.id,
      originWarehouseId: wh.id,
      currentWarehouseId: wh.id,
      pieces: data.pieces,
      weightKg: String(data.weightKg),
      volumeM3: String(data.volumeM3),
      description: data.description || null,
      note: data.note || null,
      status: "received_cn",
      receivedAt: new Date(),
      createdBy: session.sub,
    })
    .returning();

  await db.insert(cargoEvents).values({
    cargoId: cargo.id,
    type: "status_change",
    toStatus: "received_cn",
    data: { warehouse: wh.code, pieces: data.pieces },
    userId: session.sub,
  });

  await db.insert(auditLog).values({
    userId: session.sub,
    action: "create",
    entity: "cargo",
    entityId: cargo.id,
    payload: { regNumber, client: client.code, warehouse: wh.code },
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
      pieces: cargos.pieces,
      weightKg: cargos.weightKg,
      volumeM3: cargos.volumeM3,
      description: cargos.description,
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
