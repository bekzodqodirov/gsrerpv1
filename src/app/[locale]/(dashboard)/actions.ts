"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { logout } from "@/modules/shared/auth";

export async function logoutAction(): Promise<void> {
  await logout();
  const locale = await getLocale();
  redirect({ href: "/login", locale });
}
