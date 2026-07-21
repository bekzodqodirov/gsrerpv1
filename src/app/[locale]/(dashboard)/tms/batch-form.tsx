"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Button, Input, Select, Field } from "@/components/ui";
import { createBatchAction, type BatchFormState } from "./actions";

type WarehouseOption = {
  id: string;
  code: string;
  gsCode: string;
  name: string;
  country: string;
  kind: string;
};
type CarrierOption = {
  id: string;
  name: string;
  truckPlate: string | null;
};

export function BatchForm({
  warehouses,
  carriers,
  fixedOrigin,
}: {
  warehouses: WarehouseOption[];
  carriers: CarrierOption[];
  // Belgilangan jo'natuvchi ombor (Qashqar konsolidatsiyasi — KA partiya).
  fixedOrigin?: { id: string; name: string };
}) {
  const t = useTranslations("tms");
  const tc = useTranslations("common");
  const router = useRouter();
  const [state, formAction, pending] = useActionState<BatchFormState, FormData>(
    createBatchAction,
    {},
  );

  useEffect(() => {
    if (state.createdId) router.push(`/tms/${state.createdId}`);
  }, [state.createdId, router]);

  const originOpts = warehouses.filter(
    (w) => w.kind === "receiving" || w.kind === "consolidation",
  );
  // Belgilangan origin bo'lsa — manzil sifatida faqat boshqalarini ko'rsatamiz.
  const destOpts = fixedOrigin
    ? warehouses.filter((w) => w.id !== fixedOrigin.id)
    : warehouses;

  return (
    <form action={formAction}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {fixedOrigin ? (
          <Field label={t("origin")}>
            <input type="hidden" name="originWarehouseId" value={fixedOrigin.id} />
            <div className="flex h-10 items-center rounded-lg border border-line bg-surface-2 px-3 text-sm">
              {fixedOrigin.name}
            </div>
          </Field>
        ) : (
          <Field label={t("origin")} required>
            <Select name="originWarehouseId" required defaultValue="">
              <option value="" disabled>
                —
              </option>
              {originOpts.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.gsCode} — {w.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label={t("destination")} required>
          <Select name="destinationWarehouseId" required defaultValue="">
            <option value="" disabled>
              —
            </option>
            {destOpts.map((w) => (
              <option key={w.id} value={w.id}>
                {w.gsCode} — {w.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("carrier")}>
          <Select name="carrierId" defaultValue="">
            <option value="">{t("noCarrier")}</option>
            {carriers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.truckPlate ? ` · ${c.truckPlate}` : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("agreedPrice")}>
          <Input
            name="agreedPrice"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
          />
        </Field>
        <Field label={t("currency")}>
          <Select name="currency" defaultValue="USD">
            <option value="USD">USD</option>
            <option value="CNY">CNY</option>
            <option value="UZS">UZS</option>
          </Select>
        </Field>
        <Field label={t("sealNumber")}>
          <Input name="sealNumber" />
        </Field>
      </div>

      {state.error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error === "sameWarehouse" ? t("sameWarehouse") : tc("loading")}
        </p>
      )}

      <Button type="submit" disabled={pending} className="mt-4">
        {pending ? tc("loading") : t("createBatch")}
      </Button>
    </form>
  );
}
