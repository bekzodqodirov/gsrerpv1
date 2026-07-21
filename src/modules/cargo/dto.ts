import { z } from "zod";
import { cargoStatusEnum } from "@/db/schema";

export const cargoStatuses = cargoStatusEnum.enumValues;
export type CargoStatus = (typeof cargoStatuses)[number];

// Bitta qator: bitta xil tovar.
// Ikki usul:
//  a) o'lchamlar bilan: karobka L×W×H (sm) + soni + dona og'irligi → jami hisoblanadi
//  b) o'lchamsiz (o'lchab bo'lmaganda): soni + umumiy kg + umumiy kub qo'lda
export const cargoLineSchema = z
  .object({
    productName: z.string().trim().min(1).max(255),
    boxCount: z.coerce.number().int().min(1).max(100_000),
    boxLengthCm: z.coerce.number().positive().max(1000).optional(),
    boxWidthCm: z.coerce.number().positive().max(1000).optional(),
    boxHeightCm: z.coerce.number().positive().max(1000).optional(),
    weightPerBoxKg: z.coerce.number().positive().max(10_000).optional(),
    totalWeightKg: z.coerce.number().positive().max(1_000_000).optional(),
    totalVolumeM3: z.coerce.number().positive().max(10_000).optional(),
    note: z.string().trim().max(1000).optional(),
  })
  .refine(
    (l) => {
      const dims = [l.boxLengthCm, l.boxWidthCm, l.boxHeightCm];
      const some = dims.some((d) => d != null);
      const all = dims.every((d) => d != null);
      return !some || all; // o'lcham kiritilsa — uchchalasi ham
    },
    { message: "dims_incomplete" },
  )
  .refine((l) => l.weightPerBoxKg != null || l.totalWeightKg != null, {
    message: "weight_required",
  })
  .refine((l) => l.boxLengthCm != null || l.totalVolumeM3 != null, {
    message: "volume_required",
  });

export type CargoLineInput = z.infer<typeof cargoLineSchema>;

export const receiveCargoSchema = z.object({
  clientId: z.string().uuid(),
  originWarehouseId: z.string().uuid().optional().or(z.literal("")),
  lines: z.array(cargoLineSchema).min(1).max(50),
  note: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type ReceiveCargoInput = z.infer<typeof receiveCargoSchema>;

export const cargoListFilterSchema = z.object({
  status: z.enum(cargoStatuses).optional(),
  q: z.string().trim().max(64).optional(),
});

export type CargoListFilter = z.infer<typeof cargoListFilterSchema>;

/** Qator jamlarini hisoblash: kiritilgan yoki o'lchamlardan. */
export function computeLineTotals(l: CargoLineInput): {
  totalWeightKg: number;
  totalVolumeM3: number;
} {
  const totalWeightKg =
    l.weightPerBoxKg != null
      ? l.weightPerBoxKg * l.boxCount
      : (l.totalWeightKg ?? 0);
  const totalVolumeM3 =
    l.boxLengthCm != null && l.boxWidthCm != null && l.boxHeightCm != null
      ? ((l.boxLengthCm * l.boxWidthCm * l.boxHeightCm) / 1_000_000) *
        l.boxCount
      : (l.totalVolumeM3 ?? 0);
  return {
    totalWeightKg: Math.round(totalWeightKg * 1000) / 1000,
    totalVolumeM3: Math.round(totalVolumeM3 * 10000) / 10000,
  };
}
