import { z } from "zod";

const CURRENCY = z.enum(["USD", "CNY", "UZS"]);

export const exchangeRateSchema = z.object({
  currency: z.enum(["CNY", "UZS"]), // USD baza — kurs kiritilmaydi
  rateToUsd: z.coerce.number().positive().max(1000),
  rateDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type ExchangeRateInput = z.infer<typeof exchangeRateSchema>;

export const clientTariffSchema = z.object({
  clientId: z.string().uuid(),
  unit: z.enum(["kg", "m3"]),
  rate: z.coerce.number().positive().max(100_000),
  currency: CURRENCY.default("USD"),
  validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});
export type ClientTariffInput = z.infer<typeof clientTariffSchema>;

export const expenseSchema = z.object({
  category: z.enum(["truck", "rent", "salary", "customs", "other"]),
  amount: z.coerce.number().positive().max(1_000_000_000),
  currency: CURRENCY,
  spentAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  batchId: z.string().uuid().optional().or(z.literal("")),
  warehouseId: z.string().uuid().optional().or(z.literal("")),
  carrierId: z.string().uuid().optional().or(z.literal("")),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});
export type ExpenseInput = z.infer<typeof expenseSchema>;

export const paymentSchema = z.object({
  clientId: z.string().uuid(),
  invoiceId: z.string().uuid().optional().or(z.literal("")),
  amount: z.coerce.number().positive().max(1_000_000_000),
  currency: CURRENCY,
  method: z.enum(["cash", "card", "transfer"]),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});
export type PaymentInput = z.infer<typeof paymentSchema>;
