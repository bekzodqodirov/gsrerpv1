// Hujjat/kod raqamlash: doc_sequence jadvalidan tranzaksiya ichida
// keyingi raqamni oladi — parallel so'rovlarda ham takrorlanmaydi.
import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * Keyingi raqamni qaytaradi (masalan "GSR-0001" yoki "YK-2026-00001").
 * @param docType doc_sequence.doc_type qiymati
 * @param opts.year raqamga yil qo'shish (yuk partiyalari uchun)
 * @param opts.pad raqam uzunligi (default 4)
 * @param opts.separator prefix va raqam orasidagi belgi (default "-", partiya "_")
 */
export async function nextNumber(
  docType: string,
  opts: { year?: boolean; pad?: number; separator?: string } = {},
): Promise<string> {
  const pad = opts.pad ?? 4;
  const sep = opts.separator ?? "-";

  const rows = await db.execute<{ prefix: string; last_number: string }>(sql`
    UPDATE doc_sequence
    SET last_number = (last_number::bigint + 1)::text
    WHERE doc_type = ${docType}
    RETURNING prefix, last_number
  `);
  const row = rows.rows[0];
  if (!row) throw new Error(`doc_sequence topilmadi: ${docType}`);

  const num = String(row.last_number).padStart(pad, "0");
  return opts.year
    ? `${row.prefix}-${new Date().getFullYear()}-${num}`
    : `${row.prefix}${sep}${num}`;
}
