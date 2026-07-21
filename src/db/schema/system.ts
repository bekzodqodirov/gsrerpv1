import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  jsonb,
  primaryKey,
} from "drizzle-orm/pg-core";
import { warehouses } from "./catalog";

// ─── Foydalanuvchi va huquqlar ───────────────────────────────────────────────

export const users = pgTable("user", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).unique(),
  passwordHash: text("password_hash").notNull(),
  // Sklad xodimi o'z skladiga biriktiriladi: faqat shu sklad yuklarini
  // kiritadi/ko'radi. null = cheklovsiz (ofis, logist, admin).
  warehouseId: uuid("warehouse_id").references(() => warehouses.id),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const roles = pgTable("role", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 64 }).notNull().unique(), // admin, omborchi, sotuvchi...
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Huquq kodi: "inventory.receipt.create", "finance.payment.approve", ...
export const permissions = pgTable("permission", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 128 }).notNull().unique(),
  description: varchar("description", { length: 255 }),
});

export const userRoles = pgTable(
  "user_role",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.roleId] })],
);

export const rolePermissions = pgTable(
  "role_permission",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })],
);

// ─── Audit log ───────────────────────────────────────────────────────────────
// Har bir muhim amal shu yerga yoziladi. Yozuvlar hech qachon o'chirilmaydi.

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  action: varchar("action", { length: 64 }).notNull(), // create | update | void | login...
  entity: varchar("entity", { length: 64 }).notNull(), // jadval yoki hujjat turi
  entityId: varchar("entity_id", { length: 64 }),
  payload: jsonb("payload"), // o'zgarishning qisqa tafsiloti
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Hujjat raqamlash ────────────────────────────────────────────────────────
// Har bir hujjat turi uchun ketma-ket raqam: KIR-2026-000001, SOT-2026-000001...

export const docSequences = pgTable("doc_sequence", {
  docType: varchar("doc_type", { length: 32 }).primaryKey(),
  prefix: varchar("prefix", { length: 8 }).notNull(),
  lastNumber: varchar("last_number", { length: 16 }).notNull().default("0"),
});
