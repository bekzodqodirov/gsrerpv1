"use client";

import { useActionState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button, Input, Select, Field } from "@/components/ui";
import { createRateAction, type FinanceFormState } from "../actions";

export function RateForm({ today }: { today: string }) {
  const t = useTranslations("finance");
  const tc = useTranslations("common");
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<FinanceFormState, FormData>(
    createRateAction,
    {},
  );
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={formAction}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t("currency")} required>
          <Select name="currency" required defaultValue="CNY">
            <option value="CNY">CNY</option>
            <option value="UZS">UZS</option>
          </Select>
        </Field>
        <Field label={t("rateToUsd")} required>
          <Input
            name="rateToUsd"
            type="number"
            step="0.00000001"
            min="0"
            required
            inputMode="decimal"
            placeholder="0.14"
          />
        </Field>
        <Field label={t("date")} required>
          <Input name="rateDate" type="date" required defaultValue={today} />
        </Field>
      </div>
      {state.error && (
        <p className="mt-3 text-sm text-red-600">{tc("loading")}</p>
      )}
      <Button type="submit" disabled={pending} className="mt-4">
        {pending ? tc("loading") : tc("save")}
      </Button>
      <p className="mt-2 text-xs text-muted">{t("ratesHint")}</p>
    </form>
  );
}
