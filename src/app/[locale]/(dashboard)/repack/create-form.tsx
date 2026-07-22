"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Button, Input, Select, Field } from "@/components/ui";
import { createPalletAction, type CreatePalletState } from "./actions";

type Option = { id: string; code: string; name: string };
type WH = { id: string; code: string; gsCode: string; name: string };

export function CreatePalletForm({
  clients,
  warehouses,
  fixedWarehouseId,
}: {
  clients: Option[];
  warehouses: WH[];
  fixedWarehouseId: string | null;
}) {
  const t = useTranslations("repack");
  const tc = useTranslations("common");
  const router = useRouter();
  const [clientId, setClientId] = useState("");
  const [warehouseId, setWarehouseId] = useState(fixedWarehouseId ?? "");
  const [state, action, pending] = useActionState<CreatePalletState, FormData>(
    createPalletAction,
    {},
  );

  useEffect(() => {
    if (state.createdId) router.push(`/repack/${state.createdId}`);
  }, [state.createdId, router]);

  const fixedWh = fixedWarehouseId
    ? warehouses.find((w) => w.id === fixedWarehouseId)
    : null;

  return (
    <form
      action={action}
      className="grid gap-3 rounded-xl border border-line bg-surface-2/40 p-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end"
    >
      <input type="hidden" name="clientId" value={clientId} />
      <Field label={t("client")} required>
        <Select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          required
        >
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

      <Field label={t("warehouse")} required>
        {fixedWh ? (
          <Input
            readOnly
            value={`${fixedWh.gsCode} — ${fixedWh.name}`}
            className="bg-surface-2 text-muted"
          />
        ) : (
          <Select
            name="warehouseId"
            required
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
          >
            <option value="" disabled>
              —
            </option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.gsCode} — {w.name}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field label={t("note")}>
        <Input name="note" placeholder={t("notePlaceholder")} />
      </Field>

      <Button type="submit" disabled={pending || !clientId}>
        {pending ? tc("loading") : t("createPallet")}
      </Button>

      {state.error && (
        <p className="text-sm text-red-500 sm:col-span-2 lg:col-span-4">
          {t("createError")}
        </p>
      )}
    </form>
  );
}
