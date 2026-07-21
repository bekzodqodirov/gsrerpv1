"use server";

import { revalidatePath } from "next/cache";
import { createUser, setUserActive } from "@/modules/users/service";
import { userCreateSchema } from "@/modules/users/dto";

export type UserFormState = { error?: string; createdUsername?: string };

export async function createUserAction(
  _prev: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  const str = (k: string) => String(formData.get(k) ?? "");
  const parsed = userCreateSchema.safeParse({
    username: str("username"),
    fullName: str("fullName"),
    password: str("password"),
    roleCode: str("roleCode"),
    warehouseId: str("warehouseId"),
  });
  if (!parsed.success) {
    return { error: "validation" };
  }

  try {
    const user = await createUser(parsed.data);
    revalidatePath("/[locale]/settings/users", "page");
    return { createdUsername: user.username };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "USERNAME_TAKEN") return { error: "usernameTaken" };
    console.error("[users] server error:", e);
    return { error: "server" };
  }
}

export async function toggleUserActiveAction(
  id: string,
  isActive: boolean,
): Promise<void> {
  await setUserActive(id, isActive);
  revalidatePath("/[locale]/settings/users", "page");
}
