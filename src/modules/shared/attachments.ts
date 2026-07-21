// Fayl biriktirmalar: rasm, excel, word, pdf.
// Fayllar diskda (uploads/), metama'lumot bazada. Berish: /api/files/[id]
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { attachments } from "@/db/schema";

export const UPLOAD_DIR = path.join(process.cwd(), "uploads");

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
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

  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(
    path.join(UPLOAD_DIR, storedName),
    Buffer.from(await file.arrayBuffer()),
  );

  const [row] = await db
    .insert(attachments)
    .values({
      entity,
      entityId,
      fileName: file.name,
      storedName,
      mimeType: file.type,
      sizeBytes: file.size,
      uploadedBy: userId,
    })
    .returning();
  return row;
}

export async function listAttachments(entity: string, entityId: string) {
  return db.query.attachments.findMany({
    where: and(
      eq(attachments.entity, entity),
      eq(attachments.entityId, entityId),
    ),
    orderBy: attachments.createdAt,
  });
}

export async function getAttachment(id: string) {
  return db.query.attachments.findFirst({ where: eq(attachments.id, id) });
}
