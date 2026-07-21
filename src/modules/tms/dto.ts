import { z } from "zod";
import { batchStatusEnum } from "@/db/schema";
import type { CargoStatus } from "@/modules/cargo/dto";

export const batchStatuses = batchStatusEnum.enumValues;
export type BatchStatus = (typeof batchStatuses)[number];

// ─── Carrier (yollanma mashina) ──────────────────────────────────────────────

export const carrierSchema = z.object({
  name: z.string().trim().min(2).max(255),
  phone: z.string().trim().max(64).optional().or(z.literal("")),
  truckPlate: z.string().trim().max(32).optional().or(z.literal("")),
  truckType: z.string().trim().max(64).optional().or(z.literal("")),
  capacityKg: z.coerce.number().positive().max(1_000_000).optional(),
  capacityM3: z.coerce.number().positive().max(10_000).optional(),
  note: z.string().trim().max(1000).optional().or(z.literal("")),
});
export type CarrierInput = z.infer<typeof carrierSchema>;

// ─── Batch (partiya) ─────────────────────────────────────────────────────────

export const batchCreateSchema = z.object({
  originWarehouseId: z.string().uuid(),
  destinationWarehouseId: z.string().uuid(),
  carrierId: z.string().uuid().optional().or(z.literal("")),
  agreedPrice: z.coerce.number().nonnegative().max(1_000_000_000).optional(),
  currency: z.enum(["USD", "CNY", "UZS"]).optional().or(z.literal("")),
  sealNumber: z.string().trim().max(64).optional().or(z.literal("")),
  note: z.string().trim().max(2000).optional().or(z.literal("")),
});
export type BatchCreateInput = z.infer<typeof batchCreateSchema>;

export const scanSchema = z.object({
  code: z.string().trim().min(3).max(64),
});
export type ScanInput = z.infer<typeof scanSchema>;

// Scan natijasi — UI'da darrov feedback (ovoz/rang) uchun.
export type ScanOutcome =
  | "loaded" //      karobka yuklandi (birinchi marta)
  | "unloaded" //    karobka qabul qilindi
  | "duplicate" //   allaqachon scan qilingan
  | "not_on_plan" // haqiqiy karobka, lekin bu partiyaga tegishli emas
  | "extra" //       manifestda yo'q karobka tushirildi (ortiqcha)
  | "unknown" //     bunday QR umuman topilmadi
  | "wrong_status"; // partiya holati scan qilishga mos emas

export type ScanResult = {
  outcome: ScanOutcome;
  code: string;
  label?: string; // "GSR-1007 · Mebel furnitura · 12/50"
  done?: number;
  total?: number;
};

/**
 * Partiya jo'nashida (origin) va tushirilishida (destination) yuk qanday
 * holatga o'tishi — manzil ombori turi bo'yicha.
 */
export function legStatuses(
  destCountry: string,
  destKind: string,
): { inTransit: CargoStatus; arrived: CargoStatus } {
  if (destCountry === "UZ") {
    return { inTransit: "in_transit_uz", arrived: "at_uz_warehouse" };
  }
  if (destKind === "consolidation") {
    return { inTransit: "in_transit_ksg", arrived: "at_kashgar" };
  }
  // Zaxira: Xitoy ichidagi boshqa yo'nalishlar ham Qashqarga o'xshaydi.
  return { inTransit: "in_transit_ksg", arrived: "at_kashgar" };
}

/** Origin ombordagi qaysi holatdagi yuklar shu partiyaga qo'yilishi mumkin. */
export function sourceStatusForOrigin(originKind: string): CargoStatus {
  // Qashqar (konsolidatsiya) — at_kashgar; Xitoy qabul ombori — received_cn.
  return originKind === "consolidation" ? "at_kashgar" : "received_cn";
}
