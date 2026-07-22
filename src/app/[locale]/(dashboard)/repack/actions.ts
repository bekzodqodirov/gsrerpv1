"use server";

import { revalidatePath } from "next/cache";
import {
  createPallet,
  packBox,
  unpackBox,
  setPalletStatus,
  deletePallet,
} from "@/modules/repack/service";
import { createPalletSchema, type PackResult } from "@/modules/repack/dto";

export type CreatePalletState = { error?: string; createdId?: string };

export async function createPalletAction(
  _prev: CreatePalletState,
  formData: FormData,
): Promise<CreatePalletState> {
  const parsed = createPalletSchema.safeParse({
    clientId: String(formData.get("clientId") ?? ""),
    warehouseId: String(formData.get("warehouseId") ?? "") || undefined,
    note: String(formData.get("note") ?? "") || undefined,
  });
  if (!parsed.success) return { error: "validation" };
  try {
    const p = await createPallet(parsed.data);
    revalidatePath("/[locale]/repack", "page");
    return { createdId: p.id };
  } catch {
    return { error: "server" };
  }
}

/** Karobkani scan bilan yashikga solish — jonli feedback qaytaradi. */
export async function packBoxAction(
  palletId: string,
  code: string,
): Promise<PackResult> {
  const r = await packBox(palletId, code);
  revalidatePath("/[locale]/repack/[id]", "page");
  return r;
}

export async function unpackBoxAction(palletId: string, boxId: string) {
  await unpackBox(palletId, boxId);
  revalidatePath("/[locale]/repack/[id]", "page");
}

export async function setPalletStatusAction(
  palletId: string,
  status: "open" | "closed",
) {
  await setPalletStatus(palletId, status);
  revalidatePath("/[locale]/repack/[id]", "page");
  revalidatePath("/[locale]/repack", "page");
}

export async function deletePalletAction(palletId: string) {
  await deletePallet(palletId);
  revalidatePath("/[locale]/repack", "page");
}
