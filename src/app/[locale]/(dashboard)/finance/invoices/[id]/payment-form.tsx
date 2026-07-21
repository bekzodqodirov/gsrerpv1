"use client";

import { useActionState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button, Input, Select, Field } from "@/components/ui";
import { recordPaymentAction, type PaymentFormState } from "../../actions";

export function PaymentForm({
  clientId,
  invoiceId,
  defaultCurrency,
}: {
  clientId: string;
  invoiceId: string | null;
  defaultCurrency: string;
}) {
  const t = useTranslations("finance");
  const tc = useTranslations("common");
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<PaymentFormState, FormData>(
    recordPaymentAction.bind(null, clientId, invoiceId),
    {},
  );
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={formAction}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={t("amount")} required>
          <Input name="amount" type="number" step="0.01" min="0" required inputMode="decimal" />
        </Field>
        <Field label={t("currency")} required>
          <Select name="currency" required defaultValue={defaultCurrency}>
            <option value="USD">USD</option>
            <option value="CNY">CNY</option>
            <option value="UZS">UZS</option>
          </Select>
        </Field>
        <Field label={t("method")} required>
          <Select name="method" required defaultValue="cash">
            <option value="cash">{t("cash")}</option>
            <option value="card">{t("card")}</option>
            <option value="transfer">{t("transfer")}</option>
          </Select>
        </Field>
        <Field label={t("note")}>
          <Input name="note" />
        </Field>
      </div>
      {state.error && (
        <p className="mt-3 text-sm text-red-600">
          {state.error === "noFxRate" ? t("errNoFxRate") : tc("loading")}
        </p>
      )}
      {state.ok && (
        <p className="mt-3 text-sm text-emerald-600">{t("paymentAdded")}</p>
      )}
      <Button type="submit" disabled={pending} className="mt-4">
        {pending ? tc("loading") : t("recordPayment")}
      </Button>
    </form>
  );
}
