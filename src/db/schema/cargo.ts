// Yuk partiyasi va uning hayot tsikli.
// Partiya = bitta mijozdan bitta skladda qabul qilingan yuk (joy soni, kg, kub).
// Holat zanjiri oldinga qarab yuradi; istisnolar cargo_event orqali qayd etiladi.
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  numeric,
  integer,
  jsonb,
  boolean,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { clients, warehouses, productTypes } from "./catalog";
import { users } from "./system";

// Yuk holatlari — jarayon bosqichlari:
export const cargoStatusEnum = pgEnum("cargo_status", [
  "received_cn", //      1. Xitoy skladida qabul qilindi (YW/GZ/URC yoki to'g'ridan-to'g'ri KSG)
  "in_transit_ksg", //   2. Qashqarga ichki tranzitda
  "at_kashgar", //       3. Qashqarda qabul qilindi (konsolidatsiya)
  "loaded", //           4. Xalqaro mashinaga yuklandi
  "cn_customs", //       5. Zatamojka (Xitoy eksport bojxonasi)
  "in_transit_uz", //    6. Yo'lda (chegara → O'zbekiston)
  "at_uz_warehouse", //  7. UZ customs warehouse'da qabul qilindi
  "uz_customs", //       8. Rastamojka jarayonida
  "ready", //            9. Tozalangan — tarqatishga tayyor
  "delivered", //       10. Mijozga topshirildi
  "held", //             ⚠ Ushlab turilgan (qarz, bojxona muammosi...) — sababi eventda
  "lost", //             ⚠ Yo'qolgan (to'liq)
]);

export const cargos = pgTable(
  "cargo",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    regNumber: varchar("reg_number", { length: 32 }).notNull().unique(), // YK-2026-00001
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    productTypeId: uuid("product_type_id").references(() => productTypes.id),
    description: text("description"), // tovar tavsifi (erkin matn)

    // Qabul paytidagi o'lchovlar (Xitoy skladida):
    originWarehouseId: uuid("origin_warehouse_id")
      .notNull()
      .references(() => warehouses.id),
    pieces: integer("pieces").notNull(), // joy (mest) soni
    weightKg: numeric("weight_kg", { precision: 12, scale: 3 }).notNull(),
    volumeM3: numeric("volume_m3", { precision: 12, scale: 4 }).notNull(),

    // Qashqarda qayta o'lchash (farq chiqsa shu yerda ko'rinadi):
    ksgPieces: integer("ksg_pieces"),
    ksgWeightKg: numeric("ksg_weight_kg", { precision: 12, scale: 3 }),
    ksgVolumeM3: numeric("ksg_volume_m3", { precision: 12, scale: 4 }),

    status: cargoStatusEnum("status").notNull().default("received_cn"),
    // Yuk hozir qaysi skladda (yo'lda bo'lsa null):
    currentWarehouseId: uuid("current_warehouse_id").references(
      () => warehouses.id,
    ),
    // held holatidan oldingi holat (qaytarish uchun):
    heldFromStatus: varchar("held_from_status", { length: 32 }),

    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),

    note: text("note"),
    voided: boolean("voided").notNull().default(false), // xato kiritilgan — o'chirilmaydi
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("cargo_client_idx").on(t.clientId),
    index("cargo_status_idx").on(t.status),
    index("cargo_current_wh_idx").on(t.currentWarehouseId),
  ],
);

// ─── Hodisalar jurnali ───────────────────────────────────────────────────────
// Har bir holat o'zgarishi va istisno (shikast, kamomad, ushlab turish,
// qayta o'lchash farqi) shu yerga yoziladi. Yozuvlar o'chirilmaydi.

export const cargoEvents = pgTable(
  "cargo_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cargoId: uuid("cargo_id")
      .notNull()
      .references(() => cargos.id),
    // status_change | remeasure | damage | shortage | hold | release | note
    type: varchar("type", { length: 32 }).notNull(),
    fromStatus: varchar("from_status", { length: 32 }),
    toStatus: varchar("to_status", { length: 32 }),
    // Qo'shimcha ma'lumot: {pieces: 2, reason: "..."} kabi
    data: jsonb("data"),
    comment: text("comment"),
    userId: uuid("user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("cargo_event_cargo_idx").on(t.cargoId)],
);
