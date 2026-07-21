// Valyuta konvertatsiyasi. Baza — USD. Sana bo'yicha eng oxirgi kurs olinadi.
import { and, desc, eq, lte } from "drizzle-orm";
import { db } from "@/db";
import { exchangeRates } from "@/db/schema";

/** YYYY-MM-DD (date ustuni bilan taqqoslash uchun). */
export function dateStr(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** 1 birlik valyuta necha USD (sana bo'yicha eng oxirgi kurs). USD → 1. */
export async function fxToUsd(currency: string, on?: Date): Promise<number> {
  if (currency === "USD") return 1;
  const rows = await db
    .select({ rate: exchangeRates.rateToUsd })
    .from(exchangeRates)
    .where(
      and(
        eq(exchangeRates.currency, currency),
        lte(exchangeRates.rateDate, dateStr(on)),
      ),
    )
    .orderBy(desc(exchangeRates.rateDate))
    .limit(1);
  if (!rows[0]) throw new Error(`NO_FX_RATE:${currency}`);
  return Number(rows[0].rate);
}

/** Summani USD'ga o'giradi; kursni ham qaytaradi (yozib qo'yish uchun). */
export async function toUsd(
  amount: number,
  currency: string,
  on?: Date,
): Promise<{ amountUsd: number; fxRateToUsd: number }> {
  const fxRateToUsd = await fxToUsd(currency, on);
  return {
    fxRateToUsd,
    amountUsd: Math.round(amount * fxRateToUsd * 100) / 100,
  };
}
