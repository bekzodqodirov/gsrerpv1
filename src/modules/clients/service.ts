// Mijozlar servisi. Kod avtomatik beriladi (GSR-0001) va o'zgartirilmaydi —
// mijoz karobkalariga shu kod yopishtiriladi.
import { eq, ilike, or, desc } from "drizzle-orm";
import { db } from "@/db";
import { clients, auditLog } from "@/db/schema";
import { requirePermission } from "@/modules/shared/auth";
import { nextNumber } from "@/modules/shared/numbering";
import {
  clientCreateSchema,
  clientUpdateSchema,
  type ClientCreateInput,
  type ClientUpdateInput,
} from "./dto";

export async function listClients(search?: string) {
  await requirePermission("clients.view");
  const where = search
    ? or(
        ilike(clients.code, `%${search}%`),
        ilike(clients.name, `%${search}%`),
        ilike(clients.phone, `%${search}%`),
      )
    : undefined;
  return db.query.clients.findMany({
    where,
    orderBy: desc(clients.createdAt),
    limit: 200,
  });
}

export async function getClient(id: string) {
  await requirePermission("clients.view");
  return db.query.clients.findFirst({ where: eq(clients.id, id) });
}

export async function createClient(input: ClientCreateInput) {
  const session = await requirePermission("clients.manage");
  const data = clientCreateSchema.parse(input);

  // Qo'lda kiritilgan kod — katta harfga keltiriladi va bandligi tekshiriladi
  let code: string;
  if (data.code) {
    code = data.code.toUpperCase();
    const taken = await db.query.clients.findFirst({
      where: eq(clients.code, code),
    });
    if (taken) throw new Error("CODE_TAKEN");
  } else {
    // Avtomatik kod: hisoblagichdan keyingi raqamni olamiz, lekin agar u kod
    // allaqachon band bo'lsa (qo'lda kiritilgan kodlar hisoblagichni surmaydi)
    // — xato bermasdan navbatdagi bo'sh kodgacha sakrab o'tamiz.
    code = await nextNumber("client");
    for (let guard = 0; guard < 10000; guard++) {
      const exists = await db.query.clients.findFirst({
        where: eq(clients.code, code),
        columns: { id: true },
      });
      if (!exists) break;
      code = await nextNumber("client");
    }
  }
  const [client] = await db
    .insert(clients)
    .values({
      code,
      name: data.name,
      phone: data.phone || null,
      telegram: data.telegram || null,
      city: data.city || null,
      address: data.address || null,
      creditLimitUsd:
        data.creditLimitUsd != null ? String(data.creditLimitUsd) : null,
      note: data.note || null,
    })
    .returning();

  await db.insert(auditLog).values({
    userId: session.sub,
    action: "create",
    entity: "client",
    entityId: client.id,
    payload: { code, name: data.name },
  });

  return client;
}

export async function updateClient(id: string, input: ClientUpdateInput) {
  const session = await requirePermission("clients.manage");
  const data = clientUpdateSchema.parse(input);

  const [client] = await db
    .update(clients)
    .set({
      ...(data.name !== undefined && { name: data.name }),
      ...(data.phone !== undefined && { phone: data.phone || null }),
      ...(data.telegram !== undefined && { telegram: data.telegram || null }),
      ...(data.city !== undefined && { city: data.city || null }),
      ...(data.address !== undefined && { address: data.address || null }),
      ...(data.creditLimitUsd !== undefined && {
        creditLimitUsd:
          data.creditLimitUsd != null ? String(data.creditLimitUsd) : null,
      }),
      ...(data.note !== undefined && { note: data.note || null }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      updatedAt: new Date(),
    })
    .where(eq(clients.id, id))
    .returning();
  if (!client) throw new Error("NOT_FOUND");

  await db.insert(auditLog).values({
    userId: session.sub,
    action: "update",
    entity: "client",
    entityId: id,
    payload: data,
  });

  return client;
}
