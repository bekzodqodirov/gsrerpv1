// Mijozlar ro'yxatini import qilish (haqiqiy CRM ma'lumoti).
// Ishga tushirish: npm run db:seed:clients
// Qayta ishga tushirish XAVFSIZ — kod bo'yicha mavjud mijozni takrorlamaydi
// (onConflictDoNothing), ya'ni mavjud yozuvlar o'zgartirilmaydi.
//
// Ma'lumot manbai: src/db/data/clients.json ({ code, name, phone }).
import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { db } from "./index";
import { clients } from "./schema";

type ClientRow = { code: string; name: string; phone: string | null };

async function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const raw = readFileSync(join(here, "data", "clients.json"), "utf-8");
  const rows = JSON.parse(raw) as ClientRow[];

  console.log(`Import: ${rows.length} ta mijoz...`);

  let inserted = 0;
  // Bittalab qo'shamiz — takrorlanganini o'tkazib yuboramiz (kod = unikal).
  for (const r of rows) {
    const res = await db
      .insert(clients)
      .values({
        code: r.code,
        name: r.name,
        phone: r.phone ?? null,
      })
      .onConflictDoNothing({ target: clients.code })
      .returning({ id: clients.id });
    if (res.length > 0) inserted += 1;
  }

  const skipped = rows.length - inserted;
  console.log(`✓ Qo'shildi: ${inserted}, o'tkazildi (mavjud): ${skipped}`);
  process.exit(0);
}

main().catch((e) => {
  console.error("Mijozlarni import qilishda xatolik:", e);
  process.exit(1);
});
