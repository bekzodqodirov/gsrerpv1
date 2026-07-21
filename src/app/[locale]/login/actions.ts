"use server";

import { z } from "zod";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { login } from "@/modules/shared/auth";

const loginSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(128),
});

export type LoginState = { error?: string };

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "invalid" };
  }

  const session = await login(parsed.data.username, parsed.data.password);
  if (!session) {
    return { error: "invalid" };
  }

  const locale = await getLocale();
  redirect({ href: "/", locale });
  return {};
}
