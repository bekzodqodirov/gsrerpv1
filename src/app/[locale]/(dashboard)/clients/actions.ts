"use server";

import { revalidatePath } from "next/cache";
import { createClient, updateClient } from "@/modules/clients/service";
import { clientCreateSchema } from "@/modules/clients/dto";

export type ClientFormState = { error?: string; createdCode?: string };

export async function createClientAction(
  _prev: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  // formData.get() maydon bo'lmasa null qaytaradi — Zod uchun ""ga keltiramiz
  const str = (k: string) => String(formData.get(k) ?? "");
  const raw = {
    name: str("name"),
    phone: str("phone"),
    telegram: str("telegram"),
    city: str("city"),
    address: str("address"),
    creditLimitUsd: formData.get("creditLimitUsd") || undefined,
    note: str("note"),
  };
  const parsed = clientCreateSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[clients] validation:", JSON.stringify(parsed.error.issues));
    return { error: "validation" };
  }

  try {
    const client = await createClient(parsed.data);
    revalidatePath("/[locale]/clients", "page");
    return { createdCode: client.code };
  } catch (e) {
    console.error("[clients] server error:", e);
    return { error: "server" };
  }
}

export async function toggleClientActiveAction(
  id: string,
  isActive: boolean,
): Promise<void> {
  await updateClient(id, { isActive });
  revalidatePath("/[locale]/clients", "page");
}
