"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { loginAction, type LoginState } from "./actions";

export default function LoginPage() {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    loginAction,
    {},
  );

  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <form
        action={formAction}
        className="w-full max-w-sm rounded-xl border border-gray-200 p-8 shadow-sm dark:border-gray-700"
      >
        <h1 className="text-2xl font-bold">{tc("appName")}</h1>
        <p className="mt-1 text-sm text-gray-500">{t("title")}</p>

        <label className="mt-6 block text-sm font-medium">
          {t("username")}
          <input
            name="username"
            autoComplete="username"
            required
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900"
          />
        </label>

        <label className="mt-4 block text-sm font-medium">
          {t("password")}
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900"
          />
        </label>

        {state.error && (
          <p className="mt-3 text-sm text-red-600">{t("invalidCredentials")}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-6 w-full rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? tc("loading") : t("signIn")}
        </button>
      </form>
    </main>
  );
}
