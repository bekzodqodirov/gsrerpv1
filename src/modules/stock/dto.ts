// Ombor qoldig'i (stock) — hisoblanadigan ma'lumot, alohida saqlanmaydi.
//
// Qoida (spec): karobka har doim BITTA joyda — yo partiya ichida yo'lda, yo
// biror omborda "yotibdi". Qoldiq shu holatdan KELIB CHIQADI (drift bo'lmasin).
// Hozircha TMS (partiya) yo'q, shuning uchun qoldiq cargo.status + joriy ombor
// bo'yicha aniqlanadi: quyidagi holatlar — jismonan omborda turgan yuk.
import type { CargoStatus } from "@/modules/cargo/dto";

/**
 * Omborda jismonan turgan (joy egallab yotgan) yuk holatlari.
 * Yo'ldagi (in_transit_*, loaded, cn_customs) va chiqib ketgan (delivered,
 * lost) holatlar qoldiqqa KIRMAYDI.
 */
export const RESTING_STATUSES: readonly CargoStatus[] = [
  "received_cn", // Xitoy qabul ombori
  "at_kashgar", // Qashqar konsolidatsiya
  "at_uz_warehouse", // UZ customs warehouse
  "uz_customs", // rastamojkada — hali omborda
  "ready", // tozalangan — olib ketishga tayyor, hali omborda
  "held", // ushlab turilgan — jismonan bor, belgilangan
];

// Yotish muddati guruhlari (kun): yangi → tanqidiy.
export type AgeBucket = "fresh" | "warn" | "old" | "critical";

export const AGE_BUCKETS: readonly AgeBucket[] = [
  "fresh",
  "warn",
  "old",
  "critical",
];

/** Qabuldan beri o'tgan to'liq kunlar. */
export function daysSince(from: Date, now: number): number {
  return Math.max(0, Math.floor((now - from.getTime()) / 86_400_000));
}

/** Kun → guruh: ≤7 yangi, ≤15 ogohlantirish, ≤30 eski, >30 tanqidiy. */
export function ageBucket(days: number): AgeBucket {
  if (days <= 7) return "fresh";
  if (days <= 15) return "warn";
  if (days <= 30) return "old";
  return "critical";
}

export type Buckets = Record<AgeBucket, number>;

export function emptyBuckets(): Buckets {
  return { fresh: 0, warn: 0, old: 0, critical: 0 };
}
