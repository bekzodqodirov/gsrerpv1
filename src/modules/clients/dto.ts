import { z } from "zod";

export const clientCreateSchema = z.object({
  name: z.string().trim().min(2).max(255),
  phone: z.string().trim().max(64).optional().or(z.literal("")),
  telegram: z.string().trim().max(64).optional().or(z.literal("")),
  city: z.string().trim().max(128).optional().or(z.literal("")),
  address: z.string().trim().max(1000).optional().or(z.literal("")),
  creditLimitUsd: z.coerce.number().min(0).max(1_000_000).optional(),
  note: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type ClientCreateInput = z.infer<typeof clientCreateSchema>;

export const clientUpdateSchema = clientCreateSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type ClientUpdateInput = z.infer<typeof clientUpdateSchema>;
