"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button, Input, Field, Card } from "@/components/ui";
import { loginAction, type LoginState } from "./actions";

export default function LoginPage() {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    loginAction,
    {},
  );

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="mb-6 flex items-center gap-2.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-lg font-black text-white shadow-sm">
          G
        </span>
        <span className="text-2xl font-bold tracking-tight">
          {tc("appName")}
        </span>
      </div>

      <Card className="w-full max-w-sm p-6 sm:p-8">
        <h1 className="text-lg font-semibold">{t("title")}</h1>
        <form action={formAction} className="mt-5 space-y-4">
          <Field label={t("username")} required>
            <Input name="username" autoComplete="username" required autoFocus />
          </Field>
          <Field label={t("password")} required>
            <Input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>

          {state.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {t("invalidCredentials")}
            </p>
          )}

          <Button type="submit" disabled={pending} className="w-full">
            {pending ? tc("loading") : t("signIn")}
          </Button>
        </form>
      </Card>
    </main>
  );
}
