// Moliya: tariflar, invoyslar, to'lovlar, mijoz balansi (ledger), xarajatlar.
//
// Baza valyuta — USD. Har pul yozuvi o'sha kundagi kursni saqlaydi (fxRateToUsd)
// va USD ekvivalentini yozadi — hisobotlar bir valyutada jamlanadi, drift yo'q.
// Hujjatlar o'chirilmaydi — "void" holatiga o'tkaziladi.
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  numeric,
  date,
  jsonb,
  boolean,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { clients, warehouses } from "./catalog";
import { users } from "./system";
import { cargos } from "./cargo";
import { batches, carriers } from "./trips";

// Tarif birligi: kg yoki m³ bo'yicha.
export const tariffUnitEnum = pgEnum("tariff_unit", ["kg", "m3"]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft", //           qoralama (avto-yaratildi, buxgalter ko'rib chiqadi)
  "issued", //          chiqarildi (mijozga qarz yozildi)
  "partially_paid", //  qisman to'landi
  "paid", //            to'liq to'landi
  "void", //            bekor qilindi
]);

export const expenseCategoryEnum = pgEnum("expense_category", [
  "truck", //    mashina to'lovi (partiyaga bog'liq, carrierga to'lanadi)
  "rent", //     sklad arendasi
  "salary", //   ish haqi
  "customs", //  bojxona (zatamojka/rastamojka)
  "other",
]);

export const ledgerTypeEnum = pgEnum("ledger_type", [
  "charge", //      qarz yozildi (invoys)
  "payment", //     to'lov keldi
  "adjustment", //  qo'lda tuzatish
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "card",
  "transfer",
]);

// ─── Mijoz tariflari ─────────────────────────────────────────────────────────
// Har mijozga alohida kelishilgan narx. Tarix saqlanadi (eski invoyslar eski
// narxni saqlab qoladi) — yangi narx = yangi qator, eskisi validTo bilan yopiladi.

export const clientTariffs = pgTable(
  "client_tariff",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    unit: tariffUnitEnum("unit").notNull(),
    rate: numeric("rate", { precision: 12, scale: 4 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    validFrom: date("valid_from").notNull(),
    validTo: date("valid_to"), // null = amalda
    note: text("note"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("client_tariff_client_idx").on(t.clientId)],
);

// ─── Invoyslar ───────────────────────────────────────────────────────────────

export const invoices = pgTable(
  "invoice",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    number: varchar("number", { length: 32 }).notNull().unique(), // INV-2026-00001
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    total: numeric("total", { precision: 18, scale: 2 }).notNull().default("0"),
    status: invoiceStatusEnum("status").notNull().default("draft"),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    dueAt: date("due_at"),
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
    index("invoice_client_idx").on(t.clientId),
    index("invoice_status_idx").on(t.status),
  ],
);

export const invoiceLines = pgTable(
  "invoice_line",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    cargoId: uuid("cargo_id").references(() => cargos.id),
    description: varchar("description", { length: 255 }).notNull(),
    qty: numeric("qty", { precision: 14, scale: 4 }).notNull(), // kg yoki m³
    unit: tariffUnitEnum("unit").notNull(),
    rate: numeric("rate", { precision: 12, scale: 4 }).notNull(),
    amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
  },
  (t) => [index("invoice_line_invoice_idx").on(t.invoiceId)],
);

// ─── To'lovlar ───────────────────────────────────────────────────────────────

export const payments = pgTable(
  "payment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    invoiceId: uuid("invoice_id").references(() => invoices.id),
    amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    fxRateToUsd: numeric("fx_rate_to_usd", { precision: 18, scale: 8 }).notNull(),
    amountUsd: numeric("amount_usd", { precision: 18, scale: 2 }).notNull(),
    method: paymentMethodEnum("method").notNull(),
    receivedBy: uuid("received_by").references(() => users.id),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    note: text("note"),
  },
  (t) => [index("payment_client_idx").on(t.clientId)],
);

// ─── Mijoz balansi (ledger) ──────────────────────────────────────────────────
// Har qarz/to'lov shu yerga USD ekvivalentida yoziladi; balanceAfterUsd —
// yozuvdan keyingi joriy qoldiq (musbat = mijoz qarzdor).

export const clientLedger = pgTable(
  "client_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    type: ledgerTypeEnum("type").notNull(),
    amountUsd: numeric("amount_usd", { precision: 18, scale: 2 }).notNull(), // + qarz, − to'lov
    balanceAfterUsd: numeric("balance_after_usd", {
      precision: 18,
      scale: 2,
    }).notNull(),
    refType: varchar("ref_type", { length: 16 }), // invoice | payment
    refId: uuid("ref_id"),
    note: text("note"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("client_ledger_client_idx").on(t.clientId)],
);

// ─── Xarajatlar ──────────────────────────────────────────────────────────────

export const expenses = pgTable(
  "expense",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    category: expenseCategoryEnum("category").notNull(),
    amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    fxRateToUsd: numeric("fx_rate_to_usd", { precision: 18, scale: 8 }).notNull(),
    amountUsd: numeric("amount_usd", { precision: 18, scale: 2 }).notNull(),
    // Bog'lanish (ixtiyoriy): partiya, sklad, mashina.
    batchId: uuid("batch_id").references(() => batches.id),
    warehouseId: uuid("warehouse_id").references(() => warehouses.id),
    carrierId: uuid("carrier_id").references(() => carriers.id),
    spentAt: date("spent_at").notNull(),
    note: text("note"),
    data: jsonb("data"),
    paid: boolean("paid").notNull().default(false),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("expense_category_idx").on(t.category),
    index("expense_batch_idx").on(t.batchId),
  ],
);
