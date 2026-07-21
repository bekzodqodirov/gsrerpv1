// Foydalanuvchilar boshqaruvi (Sozlamalar).
import { asc, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import {
  users,
  roles,
  userRoles,
  warehouses,
  auditLog,
} from "@/db/schema";
import { requirePermission } from "@/modules/shared/auth";
import { userCreateSchema, type UserCreateInput } from "./dto";

export async function listUsers() {
  await requirePermission("settings.users.manage");

  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      fullName: users.fullName,
      isActive: users.isActive,
      createdAt: users.createdAt,
      roleName: roles.name,
      warehouseCode: warehouses.code,
    })
    .from(users)
    .leftJoin(userRoles, eq(userRoles.userId, users.id))
    .leftJoin(roles, eq(roles.id, userRoles.roleId))
    .leftJoin(warehouses, eq(warehouses.id, users.warehouseId))
    .orderBy(asc(users.createdAt));

  // Bir foydalanuvchida bir nechta rol bo'lishi mumkin — jamlaymiz
  const map = new Map<
    string,
    {
      id: string;
      username: string;
      fullName: string;
      isActive: boolean;
      roles: string[];
      warehouseCode: string | null;
    }
  >();
  for (const r of rows) {
    const u = map.get(r.id) ?? {
      id: r.id,
      username: r.username,
      fullName: r.fullName,
      isActive: r.isActive,
      roles: [],
      warehouseCode: r.warehouseCode,
    };
    if (r.roleName && !u.roles.includes(r.roleName)) u.roles.push(r.roleName);
    map.set(r.id, u);
  }
  return [...map.values()];
}

export async function createUser(input: UserCreateInput) {
  const session = await requirePermission("settings.users.manage");
  const data = userCreateSchema.parse(input);

  const taken = await db.query.users.findFirst({
    where: eq(users.username, data.username),
  });
  if (taken) throw new Error("USERNAME_TAKEN");

  const role = await db.query.roles.findFirst({
    where: eq(roles.code, data.roleCode),
  });
  if (!role) throw new Error("ROLE_NOT_FOUND");

  const passwordHash = await bcrypt.hash(data.password, 10);

  const user = await db.transaction(async (tx) => {
    const [u] = await tx
      .insert(users)
      .values({
        username: data.username,
        fullName: data.fullName,
        passwordHash,
        warehouseId: data.warehouseId || null,
      })
      .returning();
    await tx.insert(userRoles).values({ userId: u.id, roleId: role.id });
    return u;
  });

  await db.insert(auditLog).values({
    userId: session.sub,
    action: "create",
    entity: "user",
    entityId: user.id,
    payload: { username: data.username, role: data.roleCode },
  });

  return user;
}

export async function setUserActive(id: string, isActive: boolean) {
  const session = await requirePermission("settings.users.manage");
  if (id === session.sub) throw new Error("SELF_DEACTIVATE"); // o'zini o'chira olmaydi

  const [u] = await db
    .update(users)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  if (!u) throw new Error("NOT_FOUND");

  await db.insert(auditLog).values({
    userId: session.sub,
    action: isActive ? "activate" : "deactivate",
    entity: "user",
    entityId: id,
  });

  return u;
}

/** Forma uchun: rollar va skladlar ro'yxati. */
export async function getUserFormData() {
  await requirePermission("settings.users.manage");
  const [roleList, warehouseList] = await Promise.all([
    db.query.roles.findMany({ orderBy: asc(roles.name) }),
    db.query.warehouses.findMany({
      where: eq(warehouses.isActive, true),
      orderBy: asc(warehouses.code),
      columns: { id: true, code: true, name: true },
    }),
  ]);
  return { roles: roleList, warehouses: warehouseList };
}
