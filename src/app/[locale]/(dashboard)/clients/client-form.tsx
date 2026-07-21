"use client";

import { useActionState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { createClientAction, type ClientFormState } from "./actions";

const inputCls =
  "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900";

export function ClientForm() {
  const t = useTranslations("clients");
  const tc = useTranslations("common");
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<ClientFormState, FormData>(
    createClientAction,
    {},
  );

  useEffect(() => {
    if (state.createdCode) formRef.current?.reset();
  }, [state.createdCode]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-lg border border-gray-200 p-4 dark:border-gray-700"
    >
      <h2 className="font-semibold">{t("newClient")}</h2>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block text-sm font-medium">
          {t("name")} *
          <input name="name" required minLength={2} className={inputCls} />
        </label>
        <label className="block text-sm font-medium">
          {t("phone")}
          <input name="phone" className={inputCls} />
        </label>
        <label className="block text-sm font-medium">
          Telegram
          <input name="telegram" className={inputCls} />
        </label>
        <label className="block text-sm font-medium">
          {t("city")}
          <input name="city" className={inputCls} />
        </label>
        <label className="block text-sm font-medium">
          {t("creditLimit")}
          <input
            name="creditLimitUsd"
            type="number"
            min="0"
            step="0.01"
            placeholder={t("noCredit")}
            className={inputCls}
          />
        </label>
        <label className="block text-sm font-medium">
          {t("note")}
          <input name="note" className={inputCls} />
        </label>
      </div>

      {state.error && (
        <p className="mt-3 text-sm text-red-600">{t("saveError")}</p>
      )}
      {state.createdCode && (
        <p className="mt-3 text-sm text-green-600">
          {t("created", { code: state.createdCode })}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? tc("loading") : tc("create")}
      </button>
    </form>
  );
}
