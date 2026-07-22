"use client";

// Partiyani tahrirlash (faqat planned/loading): manzil, mashina, plomba,
// narx, izoh. Mashinani KEYIN biriktirish shu forma orqali.
import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import {
  CollapsibleCard,
  Button,
  Input,
  Select,
  Field,
} from "@/components/ui";
import { updateBatchAction, type BatchFormState } from "../actions";

type WarehouseOption = { id: string; gsCode: string; name: string };
type CarrierOption = { id: string; name: string; truckPlate: string | null };

export function BatchEdit({
  batchId,
  originId,
  current,
  warehouses,
  carriers,
}: {
  batchId: string;
  originId: string;
  current: {
    destinationId: string | null;
    carrierId: string | null;
    sealNumber: string | null;
    agreedPrice: string | null;
    currency: string | null;
    note: string | null;
  };
  warehouses: WarehouseOption[];
  carriers: CarrierOption[];
}) {
  const t = useTranslations("tms");
  const tc = useTranslations("common");
  const router = useRouter();
  const [state, formAction, pending] = useActionState<BatchFormState, FormData>(
    updateBatchAction.bind(null, batchId),
    {},
  );
  const [saved, setSaved] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (state.createdId) {
      setSaved(true);
      router.refresh();
      const tm = setTimeout(() => setSaved(false), 2500);
      return () => clearTimeout(tm);
    }
  }, [state.createdId, router]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const destOpts = warehouses.filter((w) => w.id !== originId);

  return (
    <CollapsibleCard title={t("editBatch")}>
      <form action={formAction} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t("destination")} required>
            <Select
              name="destinationWarehouseId"
              required
              defaultValue={current.destinationId ?? ""}
            >
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
            <Select name="carrierId" defaultValue={current.carrierId ?? ""}>
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
              defaultValue={current.agreedPrice ?? ""}
            />
          </Field>
          <Field label={t("currency")}>
            <Select name="currency" defaultValue={current.currency ?? "USD"}>
              <option value="USD">USD</option>
              <option value="CNY">CNY</option>
              <option value="UZS">UZS</option>
            </Select>
          </Field>
          <Field label={t("sealNumber")}>
            <Input name="sealNumber" defaultValue={current.sealNumber ?? ""} />
          </Field>
          <Field label={tc("note")}>
            <Input name="note" defaultValue={current.note ?? ""} />
          </Field>
        </div>

        {state.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {state.error === "sameWarehouse"
              ? t("sameWarehouse")
              : state.error === "notEditable"
                ? t("notEditable")
                : tc("loading")}
          </p>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? tc("loading") : tc("save")}
          </Button>
          {saved && (
            <span className="text-sm font-medium text-emerald-600">
              ✓ {tc("saved")}
            </span>
          )}
        </div>
      </form>
    </CollapsibleCard>
  );
}
