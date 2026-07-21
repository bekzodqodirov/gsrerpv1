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
  carriers,
} from "./schema";

const ROLES = [
  { code: "admin", name: "Administrator" },
  { code: "omborchi", name: "Omborchi" },
  { code: "logist", name: "Logist" },
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
  { code: "tms.view", description: "Partiya/mashinalarni ko'rish" },
  { code: "tms.manage", description: "Partiya/mashina va narxlarni boshqarish" },
  { code: "tms.load", description: "Mashinaga yuklash/tushirishni tasdiqlash" },
] as const;

// Skladlar: 4 Xitoy (arenda) + 2 O'zbekiston customs warehouse (namuna)
// gsCode — QR/karobka yorlig'ida ishlatiladigan qisqa kod.
const WAREHOUSES = [
  { code: "YIWU", gsCode: "GS1", name: "Yiwu skladi", country: "CN", city: "Yiwu", kind: "receiving" },
  { code: "GZ", gsCode: "GS2", name: "Guangzhou skladi", country: "CN", city: "Guangzhou", kind: "receiving" },
  { code: "URC", gsCode: "GS3", name: "Urumchi skladi", country: "CN", city: "Urumqi", kind: "receiving" },
  { code: "KSG", gsCode: "GS4", name: "Qashqar skladi", country: "CN", city: "Kashgar", kind: "consolidation" },
  { code: "TAS", gsCode: "GS5", name: "Toshkent customs warehouse", country: "UZ", city: "Toshkent", kind: "customs" },
  { code: "AND", gsCode: "GS6", name: "Andijon customs warehouse", country: "UZ", city: "Andijon", kind: "customs" },
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

  // Rol → huquqlar biriktirish (admin "*" orqali hammasini oladi).
  const roleGrants: Record<string, string[]> = {
    // Sklad xodimi: yuk qabul + mashinaga yuklash/tushirish (narxni KO'RMAYDI)
    omborchi: [
      "cargo.view",
      "cargo.receive",
      "cargo.move",
      "clients.view",
      "tms.view",
      "tms.load",
    ],
    // Logist: barcha ombor qoldig'i, partiya/mashina va narxlarni boshqaradi
    logist: [
      "cargo.view",
      "cargo.move",
      "clients.view",
      "tms.view",
      "tms.manage",
      "tms.load",
    ],
  };
  for (const [roleCode, perms] of Object.entries(roleGrants)) {
    const role = await db.query.roles.findFirst({ where: eq(roles.code, roleCode) });
    if (!role) continue;
    for (const permCode of perms) {
      const perm = await db.query.permissions.findFirst({
        where: eq(permissions.code, permCode),
      });
      if (perm) {
        await db
          .insert(rolePermissions)
          .values({ roleId: role.id, permissionId: perm.id })
          .onConflictDoNothing();
      }
    }
  }

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

  // Namuna yollanma mashinalar (bozordan yollanadigan)
  const CARRIERS = [
    { name: "Chen Wei", phone: "+86 138 0011 2233", truckPlate: "浙G·88888", truckType: "Tent 40t", capacityKg: "28000", capacityM3: "82" },
    { name: "Aziz Karimov", phone: "+998 90 123 45 67", truckPlate: "01 A 777 BC", truckType: "Refrijerator", capacityKg: "20000", capacityM3: "60" },
    { name: "Li Ming Logistics", phone: "+86 139 5566 7788", truckPlate: "新A·66666", truckType: "Tent 20t", capacityKg: "15000", capacityM3: "45" },
  ];
  for (const c of CARRIERS) {
    const exists = await db.query.carriers.findFirst({
      where: eq(carriers.name, c.name),
    });
    if (!exists) {
      await db.insert(carriers).values(c);
      console.log(`+ mashina: ${c.name}`);
    }
  }

  console.log("Seed tugadi.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
