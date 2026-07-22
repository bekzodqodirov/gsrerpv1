"use server";

import { revalidatePath } from "next/cache";
import { setCargoZone } from "@/modules/stock/service";

/** Prixodning sklad ichidagi zonasini saqlash (bo'sh = o'chirish). */
export async function setZoneAction(cargoId: string, zone: string) {
  await setCargoZone(cargoId, zone);
  revalidatePath("/[locale]/stock", "page");
  revalidatePath("/[locale]/tms", "layout");
}
