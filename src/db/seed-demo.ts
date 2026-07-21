// Demo ma'lumot: mijozlar + yuklar (prixodlar) turli omborlarda va turli
// yoshda. Shu tufayli Qoldiq va TMS ekranlari darrov to'ldirilgan ko'rinadi.
//
// Ishga tushirish (avval `npm run db:seed` — omborlar kerak):
//   npm run db:seed:demo
// Qayta ishga tushirish xavfsiz — mavjud mijozlar bo'lsa, yuk qo'shmaydi.
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "./index";
import {
  clients,
  warehouses,
  cargos,
  cargoLines,
  cargoBoxes,
  cargoEvents,
} from "./schema";
import { letterCodeForIndex, buildBoxCode } from "../modules/cargo/box-code";

const DAY = 86_400_000;

// Har prixod: [mijoz-indeks, ombor-kod, holat, kun-oldin, [tovar qatorlari]]
// qator: [nom, karobka, L, W, H (sm), dona-kg]
type Line = [string, number, number, number, number, number];
type Row = [number, string, "received_cn" | "at_kashgar", number, Line[]];

const CLIENTS = [
  { code: "GSR-1001", name: "Alisher Trading", phone: "+998 90 111 22 33", city: "Toshkent" },
  { code: "GSR-1002", name: "Nodira Import", phone: "+998 91 222 33 44", city: "Samarqand" },
  { code: "GSR-1003", name: "Sharq Savdo", phone: "+998 93 333 44 55", city: "Andijon" },
  { code: "GSR-1004", name: "Baraka Group", phone: "+998 94 444 55 66", city: "Farg'ona" },
  { code: "GSR-1005", name: "Zamin Textile", phone: "+998 97 555 66 77", city: "Namangan" },
  { code: "GSR-1006", name: "Oq Yo'l", phone: "+998 99 666 77 88", city: "Buxoro" },
  { code: "GSR-1007", name: "Silk Road Co", phone: "+998 90 777 88 99", city: "Toshkent" },
  { code: "GSR-1008", name: "Metan Savdo", phone: "+998 91 888 99 00", city: "Qarshi" },
];

const ROWS: Row[] = [
  [0, "YIWU", "received_cn", 2, [["O'yinchoq", 40, 35, 35, 35, 12], ["Aksessuar", 10, 30, 30, 20, 6]]],
  [1, "YIWU", "received_cn", 5, [["Kosmetika", 25, 50, 40, 30, 16]]],
  [2, "YIWU", "received_cn", 9, [["Poyabzal", 60, 45, 30, 30, 15]]],
  [3, "YIWU", "received_cn", 14, [["Kiyim", 18, 60, 40, 40, 17]]],
  [4, "YIWU", "received_cn", 22, [["Elektronika", 33, 40, 40, 35, 16]]],
  [5, "YIWU", "received_cn", 35, [["Idish-tovoq", 12, 40, 40, 40, 16]]],
  [6, "GZ", "received_cn", 1, [["Mebel furnitura", 50, 50, 40, 40, 16]]],
  [7, "GZ", "received_cn", 4, [["Santexnika", 28, 45, 45, 40, 16]]],
  [0, "GZ", "received_cn", 12, [["Avto ehtiyot", 44, 40, 40, 40, 16]]],
  [1, "GZ", "received_cn", 27, [["Charm mahsulot", 20, 45, 35, 35, 16]]],
  [2, "URC", "received_cn", 3, [["Trikotaj", 15, 40, 40, 30, 14]]],
  [3, "URC", "received_cn", 18, [["Gilam", 36, 60, 50, 30, 20]]],
  [4, "KSG", "at_kashgar", 6, [["O'yinchoq", 55, 35, 35, 35, 12]]],
  [5, "KSG", "at_kashgar", 10, [["Kosmetika", 30, 50, 40, 30, 16]]],
  [6, "KSG", "at_kashgar", 31, [["Elektronika", 22, 40, 40, 35, 16]]],
];

function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}
function round4(n: number) {
  return Math.round(n * 10000) / 10000;
}

async function main() {
  const now = Date.now();

  const existing = await db.query.clients.findFirst();
  if (existing) {
    console.log("Demo mijozlar allaqachon bor — o'tkazib yuborildi. (bo'sh baza uchun qayta ishlating)");
  }

  // Mijozlar
  const clientIds: string[] = [];
  for (const c of CLIENTS) {
    let row = await db.query.clients.findFirst({ where: eq(clients.code, c.code) });
    if (!row) {
      [row] = await db.insert(clients).values(c).returning();
      console.log(`+ mijoz: ${c.code} ${c.name}`);
    }
    clientIds.push(row.id);
  }

  // Ombor kod → { id, gsCode }
  const whList = await db.select().from(warehouses);
  const whByCode = new Map(whList.map((w) => [w.code, w]));

  let reg = 90000;
  let created = 0;
  for (const [ci, whCode, status, daysAgo, lines] of ROWS) {
    const wh = whByCode.get(whCode);
    if (!wh) continue;
    const clientId = clientIds[ci];
    const client = CLIENTS[ci];
    const regNumber = `YK-2026-${reg++}`;

    // Agar shu reg-raqam bor bo'lsa — o'tkazamiz (idempotent)
    const dup = await db.query.cargos.findFirst({ where: eq(cargos.regNumber, regNumber) });
    if (dup) continue;

    const lineTotals = lines.map(([, n, l, w, h, kg]) => ({
      weight: kg * n,
      volume: ((l * w * h) / 1_000_000) * n,
    }));
    const totalBoxes = lines.reduce((s, l) => s + l[1], 0);
    const totalWeight = lineTotals.reduce((s, t) => s + t.weight, 0);
    const totalVolume = lineTotals.reduce((s, t) => s + t.volume, 0);
    const receivedAt = new Date(now - daysAgo * DAY);

    await db.transaction(async (tx) => {
      const [cargo] = await tx
        .insert(cargos)
        .values({
          regNumber,
          clientId,
          originWarehouseId: wh.id,
          currentWarehouseId: wh.id,
          totalBoxes,
          totalWeightKg: String(round3(totalWeight)),
          totalVolumeM3: String(round4(totalVolume)),
          status,
          receivedAt,
        })
        .returning();

      let boxNo = 0;
      for (let i = 0; i < lines.length; i++) {
        const [name, n, l, w, h, kg] = lines[i];
        const letter = letterCodeForIndex(i);
        const qr = buildBoxCode(wh.gsCode, client.code, letter);
        const [line] = await tx
          .insert(cargoLines)
          .values({
            cargoId: cargo.id,
            lineNo: i + 1,
            letterCode: letter,
            productName: name,
            boxCount: n,
            boxLengthCm: String(l),
            boxWidthCm: String(w),
            boxHeightCm: String(h),
            weightPerBoxKg: String(kg),
            totalWeightKg: String(round3(lineTotals[i].weight)),
            totalVolumeM3: String(round4(lineTotals[i].volume)),
          })
          .returning();
        const boxes = Array.from({ length: n }, () => {
          boxNo += 1;
          return { cargoId: cargo.id, lineId: line.id, boxNo, qrCode: qr };
        });
        await tx.insert(cargoBoxes).values(boxes);
      }

      await tx.insert(cargoEvents).values({
        cargoId: cargo.id,
        type: "status_change",
        toStatus: status,
        data: { warehouse: wh.code, boxes: totalBoxes, demo: true },
      });
    });
    created += 1;
  }

  console.log(`+ ${created} namuna yuk qo'shildi (${CLIENTS.length} mijoz).`);
  console.log("Endi: Qoldiq va Transport ekranlari to'ldirilgan.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
