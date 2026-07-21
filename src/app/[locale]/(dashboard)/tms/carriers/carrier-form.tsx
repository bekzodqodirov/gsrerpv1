"use client";

import { useActionState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button, Input, Field } from "@/components/ui";
import { createCarrierAction, type CarrierFormState } from "../actions";

export function CarrierForm() {
  const t = useTranslations("tms");
  const tc = useTranslations("common");
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<CarrierFormState, FormData>(
    createCarrierAction,
    {},
  );

  useEffect(() => {
    if (state.created) formRef.current?.reset();
  }, [state.created]);

  return (
    <form ref={formRef} action={formAction}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label={t("carrierName")} required>
          <Input name="name" required minLength={2} />
        </Field>
        <Field label={t("phone")}>
          <Input name="phone" inputMode="tel" />
        </Field>
        <Field label={t("truckPlate")}>
          <Input name="truckPlate" className="font-mono" />
        </Field>
        <Field label={t("truckType")}>
          <Input name="truckType" />
        </Field>
        <Field label={t("capacityKg")}>
          <Input name="capacityKg" type="number" min="0" step="1" inputMode="numeric" />
        </Field>
        <Field label={t("capacityM3")}>
          <Input name="capacityM3" type="number" min="0" step="0.1" inputMode="decimal" />
        </Field>
      </div>

      {state.error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {tc("loading")}
        </p>
      )}
      {state.created && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          {t("carrierCreated")}
        </p>
      )}

      <Button type="submit" disabled={pending} className="mt-4">
        {pending ? tc("loading") : tc("create")}
      </Button>
    </form>
  );
}
