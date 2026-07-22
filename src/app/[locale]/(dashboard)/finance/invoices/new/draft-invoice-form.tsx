"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Button, Badge } from "@/components/ui";
import {
  createDraftInvoiceAction,
  type InvoiceFormState,
} from "../../actions";

type Row = {
  cargoId: string;
  regNumber: string;
  weightKg: number;
  volumeM3: number;
  charge: { qty: number; unit: "kg" | "m3"; rate: number; currency: string; amount: number } | null;
};

export function DraftInvoiceForm({
  clientId,
  rows,
}: {
  clientId: string;
  rows: Row[];
}) {
  const t = useTranslations("finance");
  const tc = useTranslations("common");
  const router = useRouter();
  const [state, formAction, pending] = useActionState<InvoiceFormState, FormData>(
    createDraftInvoiceAction,
    {},
  );
  const chargeable = rows.filter((r) => r.charge);
  const [checked, setChecked] = useState<Record<string, boolean>>(
    () => Object.fromEntries(chargeable.map((r) => [r.cargoId, true])),
  );

  useEffect(() => {
    if (state.createdId) router.push(`/finance/invoices/${state.createdId}`);
  }, [state.createdId, router]);

  const { total, currency } = useMemo(() => {
    let total = 0;
    let currency = "";
    for (const r of chargeable) {
      if (checked[r.cargoId] && r.charge) {
        total += r.charge.amount;
        currency = r.charge.currency;
      }
    }
    return { total: Math.round(total * 100) / 100, currency };
  }, [checked, chargeable]);

  const fmt = (n: number) =>
    new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);

  if (rows.length === 0) {
    return <p className="text-sm text-muted">{t("noInvoiceable")}</p>;
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="clientId" value={clientId} />
      <div className="overflow-hidden rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-2/50 text-left text-[11px] text-muted uppercase">
              <th className="w-10 px-3 py-2"></th>
              <th className="px-3 py-2">{t("cargo")}</th>
              <th className="px-3 py-2 text-right">{t("qty")}</th>
              <th className="px-3 py-2 text-right">{t("rate")}</th>
              <th className="px-3 py-2 text-right">{t("amount")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.cargoId} className="border-t border-line">
                <td className="px-3 py-2">
                  {r.charge ? (
                    <input
                      type="checkbox"
                      name="cargoId"
                      value={r.cargoId}
                      checked={!!checked[r.cargoId]}
                      onChange={(e) =>
                        setChecked((c) => ({ ...c, [r.cargoId]: e.target.checked }))
                      }
                      className="h-4 w-4"
                    />
                  ) : null}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{r.regNumber}</td>
                {r.charge ? (
                  <>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {fmt(r.charge.qty)} {r.charge.unit === "kg" ? "kg" : "m³"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {fmt(r.charge.rate)} {r.charge.currency}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {fmt(r.charge.amount)}
                    </td>
                  </>
                ) : (
                  <td colSpan={3} className="px-3 py-2 text-right">
                    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                      {t("noTariff")}
                    </Badge>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">{t("total")}</span>
        <span className="font-mono text-lg font-bold tabular-nums">
          {fmt(total)} {currency}
        </span>
      </div>

      {state.error && (
        <p className="text-sm text-red-600">
          {state.error === "noTariff"
            ? t("errNoTariff")
            : state.error === "mixedCurrency"
              ? t("errMixedCurrency")
              : tc("loading")}
        </p>
      )}

      <Button type="submit" disabled={pending || total <= 0}>
        {pending ? tc("loading") : t("createDraft")}
      </Button>
    </form>
  );
}
