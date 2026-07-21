// TMS: yollanma mashinalar (carrier) va partiyalar (batch).
//
// GSR o'z mashinasiga ega emas — har reys bozordan yollanadi. Partiya = bitta
// mashina jo'nashi (YW_001, KA_001...). Partiyaga ombordagi yuklar (cargo)
// biriktiriladi; jo'natilganda yuk qoldiqdan chiqadi, tushirilganda manzil
// omboriga tushadi (holat cargo.status orqali yuritiladi — drift bo'lmaydi).
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  numeric,
  boolean,
  pgEnum,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { warehouses, currencies } from "./catalog";
import { users } from "./system";
import { cargos } from "./cargo";

// Partiya bosqichlari:
export const batchStatusEnum = pgEnum("batch_status", [
  "planned", //   1. Rejalashtirildi (yuklar tanlanmoqda)
  "loading", //   2. Yuklanmoqda (sklad xodimi tasdiqlayapti)
  "departed", //  3. Jo'nadi (yo'lda)
  "arrived", //   4. Manzilga yetib keldi
  "unloaded", //  5. Tushirildi (manzil omboriga qabul qilindi)
  "closed", //    6. Yopildi
]);

// ─── Yollanma mashina (carrier) ──────────────────────────────────────────────

export const carriers = pgTable("carrier", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(), // haydovchi / firma nomi
  phone: varchar("phone", { length: 64 }),
  truckPlate: varchar("truck_plate", { length: 32 }),
  truckType: varchar("truck_type", { length: 64 }), // tent, refrijerator...
  capacityKg: numeric("capacity_kg", { precision: 12, scale: 2 }),
  capacityM3: numeric("capacity_m3", { precision: 12, scale: 2 }),
  // 1..5 reys sifatiga qarab (reysdan keyin qo'yiladi):
  rating: numeric("rating", { precision: 3, scale: 2 }),
  note: text("note"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Partiya (batch) ─────────────────────────────────────────────────────────

export const batches = pgTable(
  "batch",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 32 }).notNull().unique(), // YW_001, KA_001
    originWarehouseId: uuid("origin_warehouse_id")
      .notNull()
      .references(() => warehouses.id),
    destinationWarehouseId: uuid("destination_warehouse_id")
      .notNull()
      .references(() => warehouses.id),
    carrierId: uuid("carrier_id").references(() => carriers.id),

    // Kelishilgan narx — FAQAT logist/admin/buxgalter ko'radi (sklad xodimiga
    // hech qachon ko'rsatilmaydi; service qatlamida filtrlaydi).
    agreedPrice: numeric("agreed_price", { precision: 18, scale: 2 }),
    currency: varchar("currency", { length: 3 }).references(
      () => currencies.code,
    ),

    status: batchStatusEnum("status").notNull().default("planned"),
    sealNumber: varchar("seal_number", { length: 64 }), // plomba raqami

    plannedAt: timestamp("planned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    departedAt: timestamp("departed_at", { withTimezone: true }),
    arrivedAt: timestamp("arrived_at", { withTimezone: true }),
    unloadedAt: timestamp("unloaded_at", { withTimezone: true }),

    note: text("note"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("batch_origin_idx").on(t.originWarehouseId),
    index("batch_status_idx").on(t.status),
  ],
);

// ─── Partiya tarkibi (qaysi yuklar shu mashinada) ────────────────────────────
// Bir yuk bir vaqtda faqat bitta ochiq partiyada bo'lishi mumkin.

export const batchCargos = pgTable(
  "batch_cargo",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => batches.id, { onDelete: "cascade" }),
    cargoId: uuid("cargo_id")
      .notNull()
      .references(() => cargos.id),
    // Sklad xodimi yuklashda tasdiqlaydi (QR/reg raqam bo'yicha):
    scanned: boolean("scanned").notNull().default(false),
    loadedAt: timestamp("loaded_at", { withTimezone: true }),
    loadedBy: uuid("loaded_by").references(() => users.id),
  },
  (t) => [
    index("batch_cargo_batch_idx").on(t.batchId),
    index("batch_cargo_cargo_idx").on(t.cargoId),
    unique("batch_cargo_uq").on(t.batchId, t.cargoId),
  ],
);
