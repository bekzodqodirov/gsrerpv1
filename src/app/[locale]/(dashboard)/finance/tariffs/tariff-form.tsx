"use client";

import { useActionState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button, Input, Select, Field } from "@/components/ui";
import { createTariffAction, type FinanceFormState } from "../actions";

type ClientOption = { id: string; code: string; name: string };

export function TariffForm({
  clients,
  today,
}: {
  clients: ClientOption[];
  today: string;
}) {
  const t = useTranslations("finance");
  const tc = useTranslations("common");
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<FinanceFormState, FormData>(
    createTariffAction,
    {},
  );
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={formAction}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label={t("client")} required>
          <Select name="clientId" required defaultValue="">
            <option value="" disabled>
              —
            </option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("unit")} required>
          <Select name="unit" required defaultValue="kg">
            <option value="kg">{t("perKg")}</option>
            <option value="m3">{t("perM3")}</option>
          </Select>
        </Field>
        <Field label={t("rate")} required>
          <Input name="rate" type="number" step="0.0001" min="0" required inputMode="decimal" />
        </Field>
        <Field label={t("currency")} required>
          <Select name="currency" required defaultValue="USD">
            <option value="USD">USD</option>
            <option value="CNY">CNY</option>
            <option value="UZS">UZS</option>
          </Select>
        </Field>
        <Field label={t("validFrom")} required>
          <Input name="validFrom" type="date" required defaultValue={today} />
        </Field>
        <Field label={t("note")}>
          <Input name="note" />
        </Field>
      </div>
      {state.error && <p className="mt-3 text-sm text-red-600">{tc("loading")}</p>}
      <Button type="submit" disabled={pending} className="mt-4">
        {pending ? tc("loading") : tc("save")}
      </Button>
      <p className="mt-2 text-xs text-muted">{t("tariffsHint")}</p>
    </form>
  );
}
