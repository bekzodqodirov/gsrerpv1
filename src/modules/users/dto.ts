import { z } from "zod";

export const userCreateSchema = z.object({
  username: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9_.-]{3,64}$/),
  fullName: z.string().trim().min(2).max(255),
  password: z.string().min(6).max(128),
  roleCode: z.string().trim().min(2).max(64),
  // Sklad xodimi uchun; bo'sh = cheklovsiz (ofis)
  warehouseId: z.string().uuid().optional().or(z.literal("")),
});

export type UserCreateInput = z.infer<typeof userCreateSchema>;
