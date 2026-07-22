// Qayta upakovka (repack): ombordagi karobkalarni bitta tahta yashik (paddon)
// ichiga scan qilib jamlash. Qaror: bitta yashik = bitta mijoz; yuklashda
// yashik QR'i scan qilinadi (ichidagi karobkalar birga yuklanadi).
import { z } from "zod";

export const createPalletSchema = z.object({
  warehouseId: z.string().uuid().optional(),
  clientId: z.string().uuid(),
  note: z.string().max(500).optional(),
});
export type CreatePalletInput = z.infer<typeof createPalletSchema>;

// Karobkani yashikga solish (scan) natijasi — UI'da darrov feedback uchun.
export type PackOutcome =
  | "packed" //         solindi (birinchi marta)
  | "moved" //          boshqa yashikdan ko'chirildi
  | "already_here" //   allaqachon shu yashikda
  | "wrong_client" //   boshqa mijozning karobkasi (yashik bitta mijozники)
  | "not_here" //       karobka bu omborda emas (boshqa joyda / yo'lda)
  | "pallet_closed" //  yashik yopilgan — solib bo'lmaydi
  | "unknown"; //       bunday QR topilmadi

export type PackResult = {
  outcome: PackOutcome;
  code: string;
  label?: string; // "GSR-1007-B · Mebel furnitura"
  count?: number; // yashikdagi joriy karobka soni
};

export const PACK_GOOD: PackOutcome[] = ["packed", "moved"];
