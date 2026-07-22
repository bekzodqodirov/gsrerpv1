// Karobka harf kodi: har prixod ichida A, B, ... Z, AA, AB, ... ZZ,
// so'ngra yana A ga qaytadi (702 ta kombinatsiyadan keyin sikllanadi).
const CYCLE = 26 + 26 * 26; // 702

export function letterCodeForIndex(zeroBasedIndex: number): string {
  const idx = zeroBasedIndex % CYCLE;
  if (idx < 26) return String.fromCharCode(65 + idx);
  const rem = idx - 26;
  const first = Math.floor(rem / 26);
  const second = rem % 26;
  return String.fromCharCode(65 + first) + String.fromCharCode(65 + second);
}

/**
 * Mijozning UZLUKSIZ harf ketma-ketligidan `count` ta tartib (0-based) beradi.
 * `lastSeq` — mijozning shu paytgacha ajratilgan harflari SONI (client.lastLetterSeq).
 * Harflar prixoddan prixodga DAVOM etadi (A,B → C,D → ...), boshidan boshlanmaydi;
 * ZZ (701) dan keyin letterCodeForIndex avtomatik A ga qaytadi.
 * `reuse` — tahrirda saqlanadigan eski tartiblar (avval ular ishlatiladi).
 * Sof funksiya — test bilan qulflangan (box-code.test.ts).
 */
export function nextLetterSeqs(
  lastSeq: number,
  count: number,
  reuse: number[] = [],
): { seqs: number[]; newLast: number } {
  const reuseSorted = [...reuse].sort((a, b) => a - b).slice(0, count);
  const extra = count - reuseSorted.length;
  const seqs: number[] = [];
  for (let i = 0; i < count; i++) {
    seqs.push(
      i < reuseSorted.length
        ? reuseSorted[i]
        : lastSeq + (i - reuseSorted.length),
    );
  }
  return { seqs, newLast: lastSeq + extra };
}

/** Tovar (qator) darajasidagi harf-kod matni: GS1-GSR0002-A (inson uchun). */
export function buildBoxCode(
  gsCode: string,
  clientCode: string,
  letter: string,
): string {
  return `${gsCode}-${clientCode}-${letter}`;
}

/**
 * Har karobkaning UNIKAL QR matni: YK-2026-00006-B037.
 * reg-raqam (prixod bo'yicha unikal) + karobka tartib raqami — global unikal,
 * to'g'ridan-to'g'ri bitta karobkaga ishora qiladi (scan qilish uchun).
 */
export function buildBoxQr(regNumber: string, boxNo: number): string {
  return `${regNumber}-B${String(boxNo).padStart(3, "0")}`;
}
