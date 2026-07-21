// Auth service: login tekshiruvi, joriy sessiya, huquq talab qilish.
// Faqat server tomonda ishlatiladi.
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import {
  users,
  userRoles,
  rolePermissions,
  permissions,
  auditLog,
} from "@/db/schema";
import {
  signSession,
  verifySession,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  type SessionPayload,
} from "./session";

/** Login: muvaffaqiyatda sessiya cookie o'rnatadi, aks holda null. */
export async function login(
  username: string,
  password: string,
): Promise<SessionPayload | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.username, username),
  });
  if (!user || !user.isActive) return null;

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;

  // Foydalanuvchining barcha huquq kodlarini yig'amiz
  const rows = await db
    .select({ code: permissions.code })
    .from(userRoles)
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(eq(userRoles.userId, user.id));

  const payload: SessionPayload = {
    sub: user.id,
    username: user.username,
    fullName: user.fullName,
    perms: [...new Set(rows.map((r) => r.code))],
    warehouseId: user.warehouseId ?? null,
  };

  const token = await signSession(payload);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });

  await db.insert(auditLog).values({
    userId: user.id,
    action: "login",
    entity: "user",
    entityId: user.id,
  });

  return payload;
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

/** Joriy sessiya (yo'q bo'lsa null). */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  return verifySession(cookieStore.get(SESSION_COOKIE)?.value);
}

/** Sessiya yoki huquq bo'lmasa xato otadi — service qatlamida ishlatiladi. */
export async function requirePermission(
  code: string,
): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  if (!session.perms.includes("*") && !session.perms.includes(code)) {
    throw new Error(`FORBIDDEN: ${code}`);
  }
  return session;
}
