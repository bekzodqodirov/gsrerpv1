// Yuk (prixod) va uning tarkibi.
//
// Tuzilma:
//   cargo (prixod, YK-2026-00001) — bitta mijozdan bitta skladda bir qabul
//     └── cargo_line (qator) — har xil tovar alohida qator:
//           "oyinchoq 35×35×35, 30 karobka, 25 kg dan"
//           "kosmetika 50×55×60, 70 karobka, 50 kg dan"
//         └── cargo_box (karobka) — har biriga unique QR: YK-2026-00001-B001
//   pallet (paddon) — qayta upakovkada karobkalar paddonga biriktiriladi
//   attachment — rasm/fayl (prixodga ham, qatorga ham)
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
  unique,
  customType,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { clients, warehouses } from "./catalog";
import { users } from "./system";

// Postgres bytea — fayl baytlarini to'g'ridan-to'g'ri bazada saqlash uchun.
// Diskka bog'liqlikni yo'qotadi (ephemeral serverlarda ham fayllar yo'qolmaydi).
const bytea = customType<{ data: Buffer; default: false }>({
  dataType() {
    return "bytea";
  },
});

// Yuk holatlari — jarayon bosqichlari:
export const cargoStatusEnum = pgEnum("cargo_status", [
  "received_cn", //      1. Xitoy skladida qabul qilindi
  "in_transit_ksg", //   2. Qashqarga ichki tranzitda
  "at_kashgar", //       3. Qashqarda qabul qilindi (konsolidatsiya)
  "loaded", //           4. Xalqaro mashinaga yuklandi
  "cn_customs", //       5. Zatamojka (Xitoy eksport bojxonasi)
  "in_transit_uz", //    6. Yo'lda (chegara → O'zbekiston)
  "at_uz_warehouse", //  7. UZ customs warehouse'da qabul qilindi
  "uz_customs", //       8. Rastamojka jarayonida
  "ready", //            9. Tozalangan — tarqatishga tayyor
  "delivered", //       10. Mijozga topshirildi
  "held", //             ⚠ Ushlab turilgan (qarz, bojxona muammosi...)
  "lost", //             ⚠ Yo'qolgan (to'liq)
  "returned", //         ⚠ Qaytarildi (ombordan chiqarildi — qoldiqqa kirmaydi)
]);

// ─── Prixod (yuk qabul hujjati) ──────────────────────────────────────────────

export const cargos = pgTable(
  "cargo",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    regNumber: varchar("reg_number", { length: 32 }).notNull().unique(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),

    originWarehouseId: uuid("origin_warehouse_id")
      .notNull()
      .references(() => warehouses.id),
    currentWarehouseId: uuid("current_warehouse_id").references(
      () => warehouses.id,
    ),

    // Qatorlardan yig'ilgan jami (denormalizatsiya — ro'yxat tez ochilishi uchun):
    totalBoxes: integer("total_boxes").notNull().default(0),
    totalWeightKg: numeric("total_weight_kg", { precision: 12, scale: 3 })
      .notNull()
      .default("0"),
    totalVolumeM3: numeric("total_volume_m3", { precision: 12, scale: 4 })
      .notNull()
      .default("0"),

    // Qashqarda qayta o'lchash (farq chiqsa shu yerda ko'rinadi):
    ksgBoxes: integer("ksg_boxes"),
    ksgWeightKg: numeric("ksg_weight_kg", { precision: 12, scale: 3 }),
    ksgVolumeM3: numeric("ksg_volume_m3", { precision: 12, scale: 4 }),

    status: cargoStatusEnum("status").notNull().default("received_cn"),
    heldFromStatus: varchar("held_from_status", { length: 32 }),

    // Sklad ichidagi joyi (zona/qator: A, B, 1-qator...) — yuklashda topish uchun.
    storageZone: varchar("storage_zone", { length: 32 }),
    // Qoldiq prixod: mashinaga sig'may bo'lingan bo'lsa — asl prixodga ishora.
    splitFrom: uuid("split_from").references((): AnyPgColumn => cargos.id),

    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),

    note: text("note"),
    voided: boolean("voided").notNull().default(false),
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

// ─── Qator (har xil tovar alohida) ───────────────────────────────────────────
// O'lchamlar karobka bo'yicha (sm). O'lchab bo'lmagan holatda o'lchamlar bo'sh
// qoladi va umumiy kg/kub qo'lda kiritiladi.

export const cargoLines = pgTable(
  "cargo_line",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cargoId: uuid("cargo_id")
      .notNull()
      .references(() => cargos.id),
    lineNo: integer("line_no").notNull(), // 1, 2, 3...
    // Mijoz bo'yicha UZLUKSIZ harf ketma-ketligidagi absolyut tartib (0-based):
    // client.lastLetterSeq dan ajratiladi. Shu son letterCodeForIndex orqali
    // harfga aylanadi (0→A, 1→B, ... 26→AA). Yangi prixod oldingi harfdan
    // davom etadi — boshidan A ga qaytmaydi.
    letterSeq: integer("letter_seq").notNull().default(0),
    // Yuqoridagi tartibdan hisoblangan harf-kod matni (A, B, ... AA): inson
    // o'qishi va yorliqlar uchun. letterSeq bilan sinxron saqlanadi.
    letterCode: varchar("letter_code", { length: 4 }).notNull(),
    productName: varchar("product_name", { length: 255 }).notNull(),

    boxCount: integer("box_count").notNull(),
    // Karobka o'lchamlari (sm) — ixtiyoriy:
    boxLengthCm: numeric("box_length_cm", { precision: 8, scale: 2 }),
    boxWidthCm: numeric("box_width_cm", { precision: 8, scale: 2 }),
    boxHeightCm: numeric("box_height_cm", { precision: 8, scale: 2 }),
    // Bir karobka og'irligi (kg) — ixtiyoriy:
    weightPerBoxKg: numeric("weight_per_box_kg", { precision: 10, scale: 3 }),

    // Yakuniy jami (kiritilgan yoki hisoblangan):
    totalWeightKg: numeric("total_weight_kg", {
      precision: 12,
      scale: 3,
    }).notNull(),
    totalVolumeM3: numeric("total_volume_m3", {
      precision: 12,
      scale: 4,
    }).notNull(),

    note: text("note"),
  },
  (t) => [
    index("cargo_line_cargo_idx").on(t.cargoId),
    unique("cargo_line_no_uq").on(t.cargoId, t.lineNo),
  ],
);

// ─── Paddon (qayta upakovka) ─────────────────────────────────────────────────

export const pallets = pgTable("pallet", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 64 }).notNull().unique(), // PLT-2026-0001 (yashik QR'i)
  warehouseId: uuid("warehouse_id")
    .notNull()
    .references(() => warehouses.id),
  // Bitta yashik = bitta mijoz (qaror). Ichidagi karobkalar shu mijozniki.
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id),
  // open — hali to'ldirilmoqda; closed — yopilgan (yuklashga tayyor).
  status: varchar("status", { length: 16 }).notNull().default("open"),
  note: text("note"),
  createdBy: uuid("created_by").references(() => users.id),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Karobka (har biriga unique QR) ─────────────────────────────────────────

export const cargoBoxes = pgTable(
  "cargo_box",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cargoId: uuid("cargo_id")
      .notNull()
      .references(() => cargos.id),
    lineId: uuid("line_id")
      .notNull()
      .references(() => cargoLines.id),
    boxNo: integer("box_no").notNull(), // prixod ichida 1..N (ketma-ket, chiziqlar bo'yicha)
    // Har karobkaning UNIKAL QR matni: YK-2026-00006-B037 (reg-raqam + karobka
    // tartib raqami). Global unique — scan qilinganda aynan bitta karobkaga
    // ishora qiladi (yuklash/tushirishda har karobka alohida scan qilinadi).
    qrCode: varchar("qr_code", { length: 64 }).notNull(),
    // Qayta upakovkada paddonga biriktiriladi:
    palletId: uuid("pallet_id").references(() => pallets.id),
    // damaged | missing kabi belgi (istisno holatlar):
    flag: varchar("flag", { length: 16 }),
  },
  (t) => [
    index("cargo_box_cargo_idx").on(t.cargoId),
    index("cargo_box_pallet_idx").on(t.palletId),
    unique("cargo_box_qr_uq").on(t.qrCode),
    unique("cargo_box_no_uq").on(t.cargoId, t.boxNo),
  ],
);

// ─── Fayl biriktirmalar ──────────────────────────────────────────────────────
// entity: "cargo" (prixod fayllari: excel/word/pdf/rasm) | "cargo_line" (tovar rasmlari)

export const attachments = pgTable(
  "attachment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entity: varchar("entity", { length: 32 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    fileName: varchar("file_name", { length: 255 }).notNull(), // asl nom
    storedName: varchar("stored_name", { length: 64 }).notNull().unique(), // ichki identifikator
    mimeType: varchar("mime_type", { length: 128 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    // Fayl baytlari — bazada saqlanadi (siqilgan rasm). Eski disk yozuvlarida
    // null bo'lishi mumkin (o'sha holatda disk'dan o'qiladi — orqaga muvofiqlik).
    data: bytea("data"),
    uploadedBy: uuid("uploaded_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("attachment_entity_idx").on(t.entity, t.entityId)],
);

// ─── Hodisalar jurnali ───────────────────────────────────────────────────────

export const cargoEvents = pgTable(
  "cargo_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cargoId: uuid("cargo_id")
      .notNull()
      .references(() => cargos.id),
    // status_change | remeasure | repack | damage | shortage | hold | release | note
    type: varchar("type", { length: 32 }).notNull(),
    fromStatus: varchar("from_status", { length: 32 }),
    toStatus: varchar("to_status", { length: 32 }),
    data: jsonb("data"),
    comment: text("comment"),
    userId: uuid("user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("cargo_event_cargo_idx").on(t.cargoId)],
);
