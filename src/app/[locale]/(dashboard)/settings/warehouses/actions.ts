"use server";

import { revalidatePath } from "next/cache";
import { updateWarehouseCapacity } from "@/modules/stock/service";

export type CapacityState = { ok?: string; error?: string };

export async function updateCapacityAction(
  _prev: CapacityState,
  formData: FormData,
): Promise<CapacityState> {
  const id = String(formData.get("warehouseId") ?? "");
  if (!id) return { error: "validation" };
  const parse = (v: FormDataEntryValue | null) => {
    const s = String(v ?? "").trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  try {
    await updateWarehouseCapacity(id, parse(formData.get("capacityM3")), parse(formData.get("capacityKg")));
    revalidatePath("/[locale]/settings/warehouses", "page");
    revalidatePath("/[locale]/stock", "page");
    return { ok: id };
  } catch {
    return { error: "server" };
  }
}
