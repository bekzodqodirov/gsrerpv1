// Ma'lumotnomalar: mijoz, sklad, tovar turi, valyuta va kurslar.
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  numeric,
  date,
  integer,
} from "drizzle-orm/pg-core";

// ─── Mijozlar ────────────────────────────────────────────────────────────────
// Har mijozga unique code beriladi (masalan GSR-0001) — karobkalarga shu kod
// yopishtirilgan holda keladi. Kod — yukni tanib olishning asosiy vositasi.

export const clients = pgTable("client", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 64 }),
  telegram: varchar("telegram", { length: 64 }),
  city: varchar("city", { length: 128 }), // O'zbekistonda qaysi shahardan
  address: text("address"),
  // Qarzga ruxsat: null = qarz mumkin emas, qiymat = limit (USD).
  // Qarzdor mijoz yuki tarqatishda ushlab turiladi (service tekshiradi).
  creditLimitUsd: numeric("credit_limit_usd", { precision: 18, scale: 2 }),
  // Harf-kod hisoblagichi: mijozning tovar guruhlari A, B, C ... tarzida
  // KETMA-KET yuritiladi. Har yangi prixod oldingi harfdan davom etadi
  // (boshidan A ga qaytmaydi). Bu yerda mijozga berilgan harflar SONI saqlanadi
  // — keyingi harf shu qiymatdan boshlanadi (letterCodeForIndex bilan matnga).
  lastLetterSeq: integer("last_letter_seq").notNull().default(0),
  note: text("note"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Skladlar ────────────────────────────────────────────────────────────────
// Xitoy: Yiwu, Guangzhou, Urumchi (qabul) → Qashqar (konsolidatsiya).
// O'zbekiston: customs warehouse'lar (Andijon, Toshkent, ...).
// Hammasi arenda — "ownership" yo'q, faqat lokatsiya sifatida yuritiladi.

export const warehouses = pgTable("warehouse", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 16 }).notNull().unique(), // YIWU, GZ, URC, KSG, TAS, AND
  // Qisqa kod — QR/karobka yorlig'ida ishlatiladi: GS1, GS2, GS3...
  gsCode: varchar("gs_code", { length: 8 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  country: varchar("country", { length: 2 }).notNull(), // CN | UZ
  city: varchar("city", { length: 128 }),
  // receiving  — Xitoyda yuk qabul qiladigan sklad
  // consolidation — Qashqar: jamlash va xalqaro jo'natish nuqtasi
  // customs    — O'zbekistondagi bojxona ombori
  kind: varchar("kind", { length: 16 }).notNull(),
  // Sig'im (bandlik % va "mashina yollash vaqti" ogohlantirishi uchun).
  // null = belgilanmagan (u holda bandlik ko'rsatilmaydi).
  capacityM3: numeric("capacity_m3", { precision: 12, scale: 2 }),
  capacityKg: numeric("capacity_kg", { precision: 14, scale: 2 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Tovar turlari ───────────────────────────────────────────────────────────
// Tarif va bojxona (zatamojka/rastamojka) hisobiga ta'sir qiladi.

export const productTypes = pgTable("product_type", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  nameRu: varchar("name_ru", { length: 255 }),
  // Yo'naltiruvchi tariflar (shartnoma narxi partiyada alohida kiritiladi):
  defaultRatePerKgUsd: numeric("default_rate_per_kg_usd", {
    precision: 12,
    scale: 4,
  }),
  defaultRatePerM3Usd: numeric("default_rate_per_m3_usd", {
    precision: 12,
    scale: 4,
  }),
  note: text("note"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ─── Valyuta va kurslar ──────────────────────────────────────────────────────
// Baza valyuta — USD. Har valyutaning USD ga kursi sana bo'yicha saqlanadi.

export const currencies = pgTable("currency", {
  code: varchar("code", { length: 3 }).primaryKey(), // USD, CNY, UZS
  name: varchar("name", { length: 64 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

export const exchangeRates = pgTable("exchange_rate", {
  id: uuid("id").primaryKey().defaultRandom(),
  currency: varchar("currency", { length: 3 })
    .notNull()
    .references(() => currencies.code),
  // 1 birlik valyuta = rateToUsd USD (masalan CNY: 0.14)
  rateToUsd: numeric("rate_to_usd", { precision: 18, scale: 8 }).notNull(),
  rateDate: date("rate_date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
