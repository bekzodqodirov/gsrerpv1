"use client";

// Yashik (paddon) birliklari planda: har biri 1 BIRLIK. Yopiq yashiklarni
// planga qo'shish / olib tashlash. Yuklangan yashikni olib bo'lmaydi.
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Card } from "@/components/ui";
import { icons } from "@/components/icons";
import { addPlanPalletsAction, removePlanPalletAction } from "../actions";

type Planned = {
  palletId: string;
  code: string;
  clientCode: string;
  boxCount: number;
  weightKg: number;
  volumeM3: number;
  loaded: boolean;
};
type Available = {
  palletId: string;
  code: string;
  clientCode: string;
  boxCount: number;
  weightKg: number;
  volumeM3: number;
  plannedThisBatch: boolean;
};

export function PalletPlan({
  batchId,
  planned,
  available,
}: {
  batchId: string;
  planned: Planned[];
  available: Available[];
}) {
  const t = useTranslations("tms");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  // Planga hali qo'shilmagan yopiq yashiklar.
  const addable = available.filter((a) => !a.plannedThisBatch);

  function add(palletId: string) {
    setErr(null);
    startTransition(async () => {
      const r = await addPlanPalletsAction(batchId, [palletId]);
      if (r?.error) setErr(r.error);
      router.refresh();
    });
  }
  function remove(palletId: string) {
    setErr(null);
    startTransition(async () => {
      const r = await removePlanPalletAction(batchId, palletId);
      if (r?.error) setErr(r.error);
      router.refresh();
    });
  }

  if (planned.length === 0 && addable.length === 0) return null;

  return (
    <Card className="p-4">
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
        {icons.stock("h-4 w-4")}
        {t("palletUnits")}
      </div>
      <p className="mb-3 text-xs text-muted">{t("palletUnitsHint")}</p>

      {err && (
        <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
          {err === "palletReserved"
            ? t("palletReserved")
            : err === "hasScans"
              ? t("hasScans")
              : t("saveError")}
        </p>
      )}

      {/* Plandagi yashiklar */}
      {planned.length > 0 && (
        <ul className="mb-3 space-y-1.5">
          {planned.map((p) => (
            <li
              key={p.palletId}
              className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2"
            >
              <span className="font-mono text-sm font-bold">{p.code}</span>
              <span className="font-mono text-xs text-muted">{p.clientCode}</span>
              <span className="ml-auto text-xs text-muted">
                {p.boxCount} {t("boxesShort")} · {p.weightKg} kg ·{" "}
                {p.volumeM3} m³
              </span>
              {p.loaded ? (
                <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                  ✓
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => remove(p.palletId)}
                  disabled={pending}
                  className="touch-manipulation px-1 text-sm text-muted hover:text-red-600 disabled:opacity-40"
                  title={t("remove")}
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Qo'shish mumkin bo'lgan yopiq yashiklar */}
      {addable.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[11px] font-bold tracking-wider text-muted uppercase">
            {t("availableCol")}
          </div>
          {addable.map((a) => (
            <button
              key={a.palletId}
              type="button"
              onClick={() => add(a.palletId)}
              disabled={pending}
              className="flex w-full touch-manipulation items-center gap-2 rounded-lg border border-dashed border-line px-3 py-2 text-left hover:bg-surface-2 disabled:opacity-40"
            >
              <span className="font-mono text-sm font-bold">{a.code}</span>
              <span className="font-mono text-xs text-muted">{a.clientCode}</span>
              <span className="ml-auto text-xs text-muted">
                {a.boxCount} {t("boxesShort")} · {a.weightKg} kg ·{" "}
                {a.volumeM3} m³
              </span>
              <span className="rounded-md bg-primary px-2.5 py-1 text-xs font-bold text-white">
                +
              </span>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}
