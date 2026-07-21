// Boshlang'ich ma'lumotlar: rollar, huquqlar, admin foydalanuvchi.
// Ishga tushirish: npm run db:seed
// Qayta ishga tushirish xavfsiz — mavjud yozuvlarni takrorlamaydi.
import "dotenv/config";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "./index";
import {
  users,
  roles,
  permissions,
  userRoles,
  rolePermissions,
  warehouses,
  currencies,
  docSequences,
} from "./schema";

const ROLES = [
  { code: "admin", name: "Administrator" },
  { code: "omborchi", name: "Omborchi" },
  { code: "sotuvchi", name: "Sotuvchi" },
  { code: "buxgalter", name: "Buxgalter" },
  { code: "hr", name: "HR menejer" },
  { code: "direktor", name: "Direktor (ko'rish)" },
] as const;

// "*" — barcha huquqlar (faqat admin uchun).
// Modullar qo'shilgan sari bu ro'yxat kengayadi.
const PERMISSIONS = [
  { code: "*", description: "Barcha huquqlar" },
  { code: "settings.users.manage", description: "Foydalanuvchilarni boshqarish" },
  { code: "settings.roles.manage", description: "Rollarni boshqarish" },
  { code: "clients.view", description: "Mijozlarni ko'rish" },
  { code: "clients.manage", description: "Mijozlarni boshqarish" },
  { code: "cargo.view", description: "Yuklarni ko'rish" },
  { code: "cargo.receive", description: "Yuk qabul qilish" },
  { code: "cargo.move", description: "Yuk holatini o'zgartirish" },
] as const;

// Skladlar: 4 Xitoy (arenda) + 2 O'zbekiston customs warehouse (namuna)
const WAREHOUSES = [
  { code: "YIWU", name: "Yiwu skladi", country: "CN", city: "Yiwu", kind: "receiving" },
  { code: "GZ", name: "Guangzhou skladi", country: "CN", city: "Guangzhou", kind: "receiving" },
  { code: "URC", name: "Urumchi skladi", country: "CN", city: "Urumqi", kind: "receiving" },
  { code: "KSG", name: "Qashqar skladi", country: "CN", city: "Kashgar", kind: "consolidation" },
  { code: "TAS", name: "Toshkent customs warehouse", country: "UZ", city: "Toshkent", kind: "customs" },
  { code: "AND", name: "Andijon customs warehouse", country: "UZ", city: "Andijon", kind: "customs" },
] as const;

const CURRENCIES = [
  { code: "USD", name: "AQSH dollari" },
  { code: "CNY", name: "Xitoy yuani" },
  { code: "UZS", name: "O'zbek so'mi" },
] as const;

// Hujjat raqamlagichlar
const SEQUENCES = [
  { docType: "client", prefix: "GSR" }, // mijoz kodi: GSR-0001
  { docType: "cargo", prefix: "YK" }, //   yuk partiyasi: YK-2026-00001
] as const;

const ADMIN = {
  username: "admin",
  fullName: "Administrator",
  password: "admin123", // Birinchi kirishdan keyin almashtiring!
};

async function main() {
  // Rollar
  for (const r of ROLES) {
    const exists = await db.query.roles.findFirst({ where: eq(roles.code, r.code) });
    if (!exists) {
      await db.insert(roles).values(r);
      console.log(`+ rol: ${r.code}`);
    }
  }

  // Huquqlar
  for (const p of PERMISSIONS) {
    const exists = await db.query.permissions.findFirst({
      where: eq(permissions.code, p.code),
    });
    if (!exists) {
      await db.insert(permissions).values(p);
      console.log(`+ huquq: ${p.code}`);
    }
  }

  // Admin roliga "*" huquqini biriktirish
  const adminRole = (await db.query.roles.findFirst({
    where: eq(roles.code, "admin"),
  }))!;
  const allPerm = (await db.query.permissions.findFirst({
    where: eq(permissions.code, "*"),
  }))!;
  await db
    .insert(rolePermissions)
    .values({ roleId: adminRole.id, permissionId: allPerm.id })
    .onConflictDoNothing();

  // Admin foydalanuvchi
  let admin = await db.query.users.findFirst({
    where: eq(users.username, ADMIN.username),
  });
  if (!admin) {
    const passwordHash = await bcrypt.hash(ADMIN.password, 10);
    [admin] = await db
      .insert(users)
      .values({
        username: ADMIN.username,
        fullName: ADMIN.fullName,
        passwordHash,
      })
      .returning();
    console.log(`+ foydalanuvchi: ${ADMIN.username} (parol: ${ADMIN.password})`);
  }
  await db
    .insert(userRoles)
    .values({ userId: admin.id, roleId: adminRole.id })
    .onConflictDoNothing();

  // Skladlar
  for (const w of WAREHOUSES) {
    const exists = await db.query.warehouses.findFirst({
      where: eq(warehouses.code, w.code),
    });
    if (!exists) {
      await db.insert(warehouses).values(w);
      console.log(`+ sklad: ${w.code}`);
    }
  }

  // Valyutalar
  for (const c of CURRENCIES) {
    await db.insert(currencies).values(c).onConflictDoNothing();
  }
  console.log("+ valyutalar: USD, CNY, UZS");

  // Raqamlagichlar
  for (const s of SEQUENCES) {
    await db.insert(docSequences).values(s).onConflictDoNothing();
  }

  console.log("Seed tugadi.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
