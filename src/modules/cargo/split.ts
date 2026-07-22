// Prixodni BO'LISH (qoldiq prixod): mashinaga sig'magan karobkalar alohida
// prixod bo'lib skladda qoladi. Asl prixod faqat ketgan karobkalar bilan
// jo'naydi — hisob-kitob (kg/m³) ikkiga proporsional taqsimlanadi.
//
// Karobka QR kodlari O'ZGARMAYDI (stikerlar yopishtirilgan!) — karobka qatori
// shunchaki yangi prixodga ko'chiriladi; QR bo'yicha qidiruv baribir topadi.
import { and, asc, eq, inArray } from "drizzle-orm";
import { cargos, cargoLines, cargoBoxes, cargoEvents } from "@/db/schema";

const round3 = (n: number) => Math.round(n * 1000) / 1000;
const round4 = (n: number) => Math.round(n * 10000) / 10000;

export type SplitLineInput = {
  boxCount: number;
  totalWeightKg: number;
  totalVolumeM3: number;
  weightPerBoxKg?: number | null;
};

export type SplitTotals = {
  child: { weightKg: number; volumeM3: number };
  parent: { weightKg: number; volumeM3: number };
};

/**
 * Qator jamini bo'lish: `moveCount` karobka bolaga (qoldiqqa) o'tadi.
 * Og'irlik: karobka og'irligi ma'lum bo'lsa aniq, bo'lmasa proporsional.
 * parent = asl − child (yaxlitlash farqi yo'qolmasin — jami doim saqlanadi).
 */
export function computeSplitTotals(
  line: SplitLineInput,
  moveCount: number,
): SplitTotals {
  if (moveCount <= 0 || moveCount >= line.boxCount) {
    throw new Error("SPLIT_BAD_COUNT");
  }
  const childWeight =
    line.weightPerBoxKg != null
      ? round3(line.weightPerBoxKg * moveCount)
      : round3((line.totalWeightKg * moveCount) / line.boxCount);
  const childVolume = round4((line.totalVolumeM3 * moveCount) / line.boxCount);
  return {
    child: { weightKg: childWeight, volumeM3: childVolume },
    parent: {
      weightKg: round3(line.totalWeightKg - childWeight),
      volumeM3: round4(line.totalVolumeM3 - childVolume),
    },
  };
}

/** Qoldiq prixod reg-raqami: YK-2026-00011-R1 (band bo'lsa R2, R3...). */
export function remainderRegNumber(parentReg: string, attempt: number): string {
  return `${parentReg}-R${attempt}`;
}

// Drizzle tranzaksiya tipi murakkab generic — servislar bo'ylab `any` qabul
// qilingan uslub (insertLinesAndBoxes bilan bir xil).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = any;

/**
 * Qoldiq prixod yaratadi: `remainderBoxIds` karobkalar yangi prixodga o'tadi,
 * asl prixod jami mos ravishda kamayadi. Ikkalasiga ham "split" hodisasi
 * yoziladi. Chaqiruvchi tranzaksiya ichida chaqiradi va ruxsatni O'ZI
 * tekshirgan bo'lishi shart.
 */
export async function splitCargoRemainder(
  tx: Tx,
  cargoId: string,
  remainderBoxIds: string[],
  opts: { note: string; userId: string | null },
): Promise<{ id: string; regNumber: string }> {
  const cargo = await tx.query.cargos.findFirst({ where: eq(cargos.id, cargoId) });
  if (!cargo) throw new Error("NOT_FOUND");

  const allBoxes: { id: string; lineId: string }[] = await tx
    .select({ id: cargoBoxes.id, lineId: cargoBoxes.lineId })
    .from(cargoBoxes)
    .where(eq(cargoBoxes.cargoId, cargoId));
  const remainderSet = new Set(remainderBoxIds);
  const moving = allBoxes.filter((b) => remainderSet.has(b.id));
  if (moving.length === 0) throw new Error("SPLIT_EMPTY");
  if (moving.length === allBoxes.length) throw new Error("SPLIT_ALL");

  // Band bo'lmagan reg-raqam topamiz (qayta bo'lishlar uchun R2, R3...).
  let regNumber = "";
  for (let i = 1; i < 100; i++) {
    const cand = remainderRegNumber(cargo.regNumber, i);
    const exists = await tx.query.cargos.findFirst({
      where: eq(cargos.regNumber, cand),
      columns: { id: true },
    });
    if (!exists) {
      regNumber = cand;
      break;
    }
  }
  if (!regNumber) throw new Error("SPLIT_REG_EXHAUSTED");

  const [child] = await tx
    .insert(cargos)
    .values({
      regNumber,
      clientId: cargo.clientId,
      originWarehouseId: cargo.originWarehouseId,
      currentWarehouseId: cargo.currentWarehouseId,
      totalBoxes: 0,
      totalWeightKg: "0",
      totalVolumeM3: "0",
      status: cargo.status,
      storageZone: cargo.storageZone,
      splitFrom: cargo.id,
      // FIFO buzilmasin: qoldiq ham asl kelgan sana bilan yashaydi.
      receivedAt: cargo.receivedAt,
      note: opts.note,
      createdBy: opts.userId,
    })
    .returning({ id: cargos.id, regNumber: cargos.regNumber });

  const movedByLine = new Map<string, string[]>();
  for (const b of moving) {
    const arr = movedByLine.get(b.lineId) ?? [];
    arr.push(b.id);
    movedByLine.set(b.lineId, arr);
  }

  const lines = await tx.query.cargoLines.findMany({
    where: eq(cargoLines.cargoId, cargoId),
    orderBy: asc(cargoLines.lineNo),
  });

  let childLineNo = 0;
  let childBoxes = 0;
  let childKg = 0;
  let childM3 = 0;

  for (const line of lines) {
    const movedIds = movedByLine.get(line.id) ?? [];
    if (movedIds.length === 0) continue;
    childBoxes += movedIds.length;
    childLineNo += 1;

    if (movedIds.length === line.boxCount) {
      // Qator butunlay qoldiqqa o'tadi.
      childKg += Number(line.totalWeightKg);
      childM3 += Number(line.totalVolumeM3);
      await tx
        .update(cargoLines)
        .set({ cargoId: child.id, lineNo: childLineNo })
        .where(eq(cargoLines.id, line.id));
      await tx
        .update(cargoBoxes)
        .set({ cargoId: child.id })
        .where(eq(cargoBoxes.lineId, line.id));
    } else {
      const totals = computeSplitTotals(
        {
          boxCount: line.boxCount,
          totalWeightKg: Number(line.totalWeightKg),
          totalVolumeM3: Number(line.totalVolumeM3),
          weightPerBoxKg:
            line.weightPerBoxKg != null ? Number(line.weightPerBoxKg) : null,
        },
        movedIds.length,
      );
      childKg += totals.child.weightKg;
      childM3 += totals.child.volumeM3;

      const [childLine] = await tx
        .insert(cargoLines)
        .values({
          cargoId: child.id,
          lineNo: childLineNo,
          letterSeq: line.letterSeq,
          letterCode: line.letterCode, // stikerdagi harf o'zgarmaydi
          productName: line.productName,
          boxCount: movedIds.length,
          boxLengthCm: line.boxLengthCm,
          boxWidthCm: line.boxWidthCm,
          boxHeightCm: line.boxHeightCm,
          weightPerBoxKg: line.weightPerBoxKg,
          totalWeightKg: String(totals.child.weightKg),
          totalVolumeM3: String(totals.child.volumeM3),
          note: line.note,
        })
        .returning({ id: cargoLines.id });

      await tx
        .update(cargoLines)
        .set({
          boxCount: line.boxCount - movedIds.length,
          totalWeightKg: String(totals.parent.weightKg),
          totalVolumeM3: String(totals.parent.volumeM3),
        })
        .where(eq(cargoLines.id, line.id));
      await tx
        .update(cargoBoxes)
        .set({ cargoId: child.id, lineId: childLine.id })
        .where(
          and(eq(cargoBoxes.lineId, line.id), inArray(cargoBoxes.id, movedIds)),
        );
    }
  }

  // Jamlar: bola = yig'ilgan; ota = asl − bola (jami saqlanadi).
  await tx
    .update(cargos)
    .set({
      totalBoxes: childBoxes,
      totalWeightKg: String(round3(childKg)),
      totalVolumeM3: String(round4(childM3)),
    })
    .where(eq(cargos.id, child.id));
  await tx
    .update(cargos)
    .set({
      totalBoxes: cargo.totalBoxes - childBoxes,
      totalWeightKg: String(round3(Number(cargo.totalWeightKg) - childKg)),
      totalVolumeM3: String(round4(Number(cargo.totalVolumeM3) - childM3)),
      updatedAt: new Date(),
    })
    .where(eq(cargos.id, cargoId));

  await tx.insert(cargoEvents).values([
    {
      cargoId: cargoId,
      type: "split",
      data: { remainder: child.regNumber, boxes: childBoxes, note: opts.note },
      userId: opts.userId,
    },
    {
      cargoId: child.id,
      type: "split",
      data: { parent: cargo.regNumber, boxes: childBoxes, note: opts.note },
      userId: opts.userId,
    },
  ]);

  return child;
}
