// Fayl biriktirmalar: rasm, excel, word, pdf.
// Fayl baytlari BAZADA (bytea) saqlanadi — diskka bog'liqlik yo'q, ephemeral
// serverlarda ham yo'qolmaydi. Rasmlar mijoz tomonda siqiladi (webp). Metama'lumot
// ham bazada. Berish: /api/files/[id]. Eski disk yozuvlari (data=null) diskdan
// o'qiladi (orqaga muvofiqlik uchun UPLOAD_DIR saqlanadi).
import { readFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { attachments } from "@/db/schema";

export const UPLOAD_DIR = path.join(process.cwd(), "uploads");

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB (siqilgandan keyin — ancha yetarli)
const ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export async function saveAttachment(
  entity: "cargo" | "cargo_line",
  entityId: string,
  file: File,
  userId: string,
) {
  if (file.size === 0) return null;
  if (file.size > MAX_SIZE) throw new Error("FILE_TOO_LARGE");
  if (!ALLOWED_MIME.includes(file.type)) throw new Error("FILE_TYPE");

  const ext = path.extname(file.name).slice(0, 10) || "";
  const storedName = crypto.randomUUID() + ext;
  const buf = Buffer.from(await file.arrayBuffer());

  const [row] = await db
    .insert(attachments)
    .values({
      entity,
      entityId,
      fileName: file.name,
      storedName,
      mimeType: file.type,
      sizeBytes: buf.length,
      data: buf,
      uploadedBy: userId,
    })
    .returning({
      id: attachments.id,
      fileName: attachments.fileName,
      mimeType: attachments.mimeType,
      sizeBytes: attachments.sizeBytes,
    });
  return row;
}

/**
 * Fayl baytlarini beradi: bazadan (yangi yozuvlar) yoki diskdan (eski, data=null).
 * Topilmasa null.
 */
export async function readAttachmentBytes(
  att: { storedName: string; data: Buffer | null },
): Promise<Buffer | null> {
  if (att.data) return att.data;
  try {
    return await readFile(path.join(UPLOAD_DIR, att.storedName));
  } catch {
    return null;
  }
}

export async function listAttachments(entity: string, entityId: string) {
  // `data` (bytea) ni TANLAMAYMIZ — ro'yxatda faqat metama'lumot kerak, baytlar
  // katta bo'lishi mumkin (faqat /api/files/[id] da yuklanadi).
  return db.query.attachments.findMany({
    where: and(
      eq(attachments.entity, entity),
      eq(attachments.entityId, entityId),
    ),
    orderBy: attachments.createdAt,
    columns: {
      id: true,
      entity: true,
      entityId: true,
      fileName: true,
      storedName: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
    },
  });
}

export async function getAttachment(id: string) {
  return db.query.attachments.findFirst({ where: eq(attachments.id, id) });
}
