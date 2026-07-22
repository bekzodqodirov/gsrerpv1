"use client";

import { useActionState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button, Input, Select, Field } from "@/components/ui";
import { createExpenseAction, type FinanceFormState } from "../actions";

type Opt = { id: string; code?: string; name?: string };

export function ExpenseForm({
  today,
  batches,
  warehouses,
  carriers,
}: {
  today: string;
  batches: { id: string; code: string }[];
  warehouses: Opt[];
  carriers: Opt[];
}) {
  const t = useTranslations("finance");
  const tc = useTranslations("common");
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<FinanceFormState, FormData>(
    createExpenseAction,
    {},
  );
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={formAction}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={t("category")} required>
          <Select name="category" required defaultValue="truck">
            <option value="truck">{t("cat_truck")}</option>
            <option value="rent">{t("cat_rent")}</option>
            <option value="salary">{t("cat_salary")}</option>
            <option value="customs">{t("cat_customs")}</option>
            <option value="other">{t("cat_other")}</option>
          </Select>
        </Field>
        <Field label={t("amount")} required>
          <Input name="amount" type="number" step="0.01" min="0" required inputMode="decimal" />
        </Field>
        <Field label={t("currency")} required>
          <Select name="currency" required defaultValue="USD">
            <option value="USD">USD</option>
            <option value="CNY">CNY</option>
            <option value="UZS">UZS</option>
          </Select>
        </Field>
        <Field label={t("date")} required>
          <Input name="spentAt" type="date" required defaultValue={today} />
        </Field>
        <Field label={t("batch")}>
          <Select name="batchId" defaultValue="">
            <option value="">—</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("warehouse")}>
          <Select name="warehouseId" defaultValue="">
            <option value="">—</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} — {w.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("carrier")}>
          <Select name="carrierId" defaultValue="">
            <option value="">—</option>
            {carriers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
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
      {state.ok && <p className="mt-3 text-sm text-emerald-600">{tc("save")} ✓</p>}
      <Button type="submit" disabled={pending} className="mt-4">
        {pending ? tc("loading") : tc("save")}
      </Button>
    </form>
  );
}
