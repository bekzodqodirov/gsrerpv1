"use server";

import { revalidatePath } from "next/cache";
import { receiveCargo } from "@/modules/cargo/service";
import { receiveCargoSchema } from "@/modules/cargo/dto";

export type CargoFormState = { error?: string; createdReg?: string };

export async function receiveCargoAction(
  _prev: CargoFormState,
  formData: FormData,
): Promise<CargoFormState> {
  const str = (k: string) => String(formData.get(k) ?? "");
  const raw = {
    clientId: str("clientId"),
    originWarehouseId: str("originWarehouseId"),
    pieces: str("pieces"),
    weightKg: str("weightKg"),
    volumeM3: str("volumeM3"),
    description: str("description"),
    note: str("note"),
  };
  const parsed = receiveCargoSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[cargo] validation:", JSON.stringify(parsed.error.issues));
    return { error: "validation" };
  }

  try {
    const cargo = await receiveCargo(parsed.data);
    revalidatePath("/[locale]/cargo", "page");
    return { createdReg: cargo.regNumber };
  } catch (e) {
    console.error("[cargo] server error:", e);
    return { error: "server" };
  }
}
