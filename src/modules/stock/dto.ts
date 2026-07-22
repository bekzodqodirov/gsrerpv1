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

// ─── Sig'im / bandlik ────────────────────────────────────────────────────────

export type Utilization = {
  m3Pct: number | null;
  kgPct: number | null;
  /** Bog'lovchi (to'laroq) o'lcham foizi — mashina qarorini shu belgilaydi. */
  pct: number | null;
};

/** Bandlik foizlari (sig'im belgilanmagan bo'lsa null). */
export function utilization(
  m3: number,
  kg: number,
  capM3: number | null,
  capKg: number | null,
): Utilization {
  const m3Pct = capM3 && capM3 > 0 ? (m3 / capM3) * 100 : null;
  const kgPct = capKg && capKg > 0 ? (kg / capKg) * 100 : null;
  const both = [m3Pct, kgPct].filter((x): x is number => x != null);
  return { m3Pct, kgPct, pct: both.length ? Math.max(...both) : null };
}

// Ostonlar: bandlik yoki yotish muddati shundan oshsa — "mashina yollash vaqti".
export const UTIL_WARN_PCT = 80;
export const AGE_ALERT_DAYS = 15;

/** Mashina yollash tavsiya etiladimi (band yoki eski yuk ko'p). */
export function truckNeeded(pct: number | null, oldestDays: number): boolean {
  return (pct != null && pct >= UTIL_WARN_PCT) || oldestDays > AGE_ALERT_DAYS;
}
