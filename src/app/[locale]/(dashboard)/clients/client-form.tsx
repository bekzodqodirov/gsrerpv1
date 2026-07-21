"use client";

import { useActionState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button, Input, Field } from "@/components/ui";
import { createClientAction, type ClientFormState } from "./actions";

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
    <form ref={formRef} action={formAction}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label={t("name")} required>
          <Input name="name" required minLength={2} />
        </Field>
        <Field label={t("code")}>
          <Input
            name="code"
            placeholder={t("codeAuto")}
            pattern="[A-Za-z0-9_\-]{2,32}"
            className="font-mono"
          />
        </Field>
        <Field label={t("phone")}>
          <Input name="phone" type="tel" inputMode="tel" />
        </Field>
        <Field label="Telegram">
          <Input name="telegram" />
        </Field>
        <Field label={t("city")}>
          <Input name="city" />
        </Field>
        <Field label={t("creditLimit")}>
          <Input
            name="creditLimitUsd"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            placeholder={t("noCredit")}
          />
        </Field>
        <Field label={t("note")} className="sm:col-span-2 lg:col-span-3">
          <Input name="note" />
        </Field>
      </div>

      {state.error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error === "codeTaken" ? t("codeTaken") : t("saveError")}
        </p>
      )}
      {state.createdCode && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          {t("created", { code: state.createdCode })}
        </p>
      )}

      <Button type="submit" disabled={pending} className="mt-4">
        {pending ? tc("loading") : tc("create")}
      </Button>
    </form>
  );
}
