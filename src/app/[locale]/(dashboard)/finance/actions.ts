"use server";

import { revalidatePath } from "next/cache";
import {
  createExchangeRate,
  createClientTariff,
} from "@/modules/finance/service";
import {
  createDraftInvoice,
  issueInvoice,
  voidInvoice,
  recordPayment,
} from "@/modules/finance/billing";
import { createExpense } from "@/modules/finance/expenses";
import {
  exchangeRateSchema,
  clientTariffSchema,
  paymentSchema,
  expenseSchema,
} from "@/modules/finance/dto";

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

// ─── Invoyslar / to'lovlar ───────────────────────────────────────────────────

function revalidateFinance() {
  revalidatePath("/[locale]/finance", "layout");
}

export type InvoiceFormState = { error?: string; createdId?: string };

export async function createDraftInvoiceAction(
  _prev: InvoiceFormState,
  formData: FormData,
): Promise<InvoiceFormState> {
  const clientId = String(formData.get("clientId") ?? "");
  const cargoIds = formData.getAll("cargoId").map(String).filter(Boolean);
  if (!clientId || cargoIds.length === 0) return { error: "noCargo" };
  try {
    const inv = await createDraftInvoice(clientId, cargoIds);
    revalidateFinance();
    return { createdId: inv.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "NO_TARIFF") return { error: "noTariff" };
    if (msg === "MIXED_CURRENCY") return { error: "mixedCurrency" };
    console.error("[finance] draft invoice:", e);
    return { error: "server" };
  }
}

export async function issueInvoiceAction(invoiceId: string) {
  await issueInvoice(invoiceId);
  revalidateFinance();
}

export async function voidInvoiceAction(invoiceId: string) {
  await voidInvoice(invoiceId);
  revalidateFinance();
}

export type PaymentFormState = { error?: string; ok?: boolean };

export async function recordPaymentAction(
  clientId: string,
  invoiceId: string | null,
  _prev: PaymentFormState,
  formData: FormData,
): Promise<PaymentFormState> {
  const str = (k: string) => String(formData.get(k) ?? "");
  const parsed = paymentSchema.safeParse({
    clientId,
    invoiceId: invoiceId ?? "",
    amount: str("amount"),
    currency: str("currency"),
    method: str("method"),
    note: str("note"),
  });
  if (!parsed.success) return { error: "validation" };
  try {
    await recordPayment(parsed.data);
    revalidateFinance();
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.startsWith("NO_FX_RATE")) return { error: "noFxRate" };
    console.error("[finance] payment:", e);
    return { error: "server" };
  }
}

export async function createExpenseAction(
  _prev: FinanceFormState,
  formData: FormData,
): Promise<FinanceFormState> {
  const str = (k: string) => String(formData.get(k) ?? "");
  const parsed = expenseSchema.safeParse({
    category: str("category"),
    amount: str("amount"),
    currency: str("currency"),
    spentAt: str("spentAt"),
    batchId: str("batchId"),
    warehouseId: str("warehouseId"),
    carrierId: str("carrierId"),
    note: str("note"),
  });
  if (!parsed.success) return { error: "validation" };
  try {
    await createExpense(parsed.data);
    revalidatePath("/[locale]/finance/expenses", "page");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.startsWith("NO_FX_RATE")) return { error: "noFxRate" };
    console.error("[finance] expense:", e);
    return { error: "server" };
  }
}
