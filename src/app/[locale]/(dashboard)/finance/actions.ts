"use server";

import { revalidatePath } from "next/cache";
import {
  createExchangeRate,
  createClientTariff,
} from "@/modules/finance/service";
import { exchangeRateSchema, clientTariffSchema } from "@/modules/finance/dto";

export type FinanceFormState = { error?: string; ok?: boolean };

export async function createRateAction(
  _prev: FinanceFormState,
  formData: FormData,
): Promise<FinanceFormState> {
  const str = (k: string) => String(formData.get(k) ?? "");
  const parsed = exchangeRateSchema.safeParse({
    currency: str("currency"),
    rateToUsd: str("rateToUsd"),
    rateDate: str("rateDate"),
  });
  if (!parsed.success) return { error: "validation" };
  try {
    await createExchangeRate(parsed.data);
    revalidatePath("/[locale]/finance/rates", "page");
    return { ok: true };
  } catch (e) {
    console.error("[finance] rate:", e);
    return { error: "server" };
  }
}

export async function createTariffAction(
  _prev: FinanceFormState,
  formData: FormData,
): Promise<FinanceFormState> {
  const str = (k: string) => String(formData.get(k) ?? "");
  const parsed = clientTariffSchema.safeParse({
    clientId: str("clientId"),
    unit: str("unit"),
    rate: str("rate"),
    currency: str("currency"),
    validFrom: str("validFrom"),
    note: str("note"),
  });
  if (!parsed.success) return { error: "validation" };
  try {
    await createClientTariff(parsed.data);
    revalidatePath("/[locale]/finance/tariffs", "page");
    return { ok: true };
  } catch (e) {
    console.error("[finance] tariff:", e);
    return { error: "server" };
  }
}
