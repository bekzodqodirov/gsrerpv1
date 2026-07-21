import { z } from "zod";
import { cargoStatusEnum } from "@/db/schema";

export const cargoStatuses = cargoStatusEnum.enumValues;
export type CargoStatus = (typeof cargoStatuses)[number];

export const receiveCargoSchema = z.object({
  clientId: z.string().uuid(),
  // Sklad xodimi uchun majburiy emas — sessiyadagi sklad olinadi
  originWarehouseId: z.string().uuid().optional().or(z.literal("")),
  pieces: z.coerce.number().int().min(1).max(100_000),
  weightKg: z.coerce.number().positive().max(1_000_000),
  volumeM3: z.coerce.number().positive().max(10_000),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  note: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type ReceiveCargoInput = z.infer<typeof receiveCargoSchema>;

export const cargoListFilterSchema = z.object({
  status: z.enum(cargoStatuses).optional(),
  q: z.string().trim().max(64).optional(),
});

export type CargoListFilter = z.infer<typeof cargoListFilterSchema>;
