"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Input, Select, Field, controlCls, cn } from "@/components/ui";
import { receiveCargoAction, type CargoFormState } from "./actions";

type Option = { id: string; code: string; name: string };

type Line = {
  productName: string;
  boxCount: string;
  boxLengthCm: string;
  boxWidthCm: string;
  boxHeightCm: string;
  weightPerBoxKg: string;
  totalWeightKg: string;
  totalVolumeM3: string;
  manual: boolean; // o'lchab bo'lmagan: umumiy kg/kub qo'lda
};

const emptyLine = (): Line => ({
  productName: "",
  boxCount: "",
  boxLengthCm: "",
  boxWidthCm: "",
  boxHeightCm: "",
  weightPerBoxKg: "",
  totalWeightKg: "",
  totalVolumeM3: "",
  manual: false,
});

function lineToPayload(l: Line) {
  return {
    productName: l.productName,
    boxCount: l.boxCount,
    ...(l.manual
      ? { totalWeightKg: l.totalWeightKg, totalVolumeM3: l.totalVolumeM3 }
      : {
          boxLengthCm: l.boxLengthCm,
          boxWidthCm: l.boxWidthCm,
          boxHeightCm: l.boxHeightCm,
          weightPerBoxKg: l.weightPerBoxKg,
        }),
  };
}

/** Qator jamini jonli ko'rsatish uchun hisob. */
function linePreview(l: Line): { kg: number; m3: number } | null {
  const count = Number(l.boxCount);
  if (!count) return null;
  if (l.manual) {
    const kg = Number(l.totalWeightKg);
    const m3 = Number(l.totalVolumeM3);
    return kg || m3 ? { kg, m3 } : null;
  }
  const kg = Number(l.weightPerBoxKg) * count;
  const L = Number(l.boxLengthCm),
    W = Number(l.boxWidthCm),
    H = Number(l.boxHeightCm);
  const m3 = L && W && H ? ((L * W * H) / 1_000_000) * count : 0;
  return kg || m3 ? { kg, m3 } : null;
}

export function CargoForm({
  clients,
  warehouses,
  fixedWarehouseId,
}: {
  clients: Option[];
  warehouses: Option[];
  fixedWarehouseId: string | null;
}) {
  const t = useTranslations("cargo");
  const tc = useTranslations("common");
  const formRef = useRef<HTMLFormElement>(null);
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [state, formAction, pending] = useActionState<CargoFormState, FormData>(
    receiveCargoAction,
    {},
  );

  useEffect(() => {
    if (state.createdReg) {
      formRef.current?.reset();
      setLines([emptyLine()]);
    }
  }, [state.createdReg]);

  const setLine = (i: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const fixedWarehouse = fixedWarehouseId
    ? warehouses.find((w) => w.id === fixedWarehouseId)
    : null;

  const totals = lines.reduce(
    (acc, l) => {
      const p = linePreview(l);
      if (p) {
        acc.kg += p.kg;
        acc.m3 += p.m3;
        acc.boxes += Number(l.boxCount) || 0;
      }
      return acc;
    },
    { boxes: 0, kg: 0, m3: 0 },
  );

  return (
    <form ref={formRef} action={formAction}>
      <input
        type="hidden"
        name="linesJson"
        value={JSON.stringify(lines.map(lineToPayload))}
      />

      {/* Prixod sarlavhasi */}
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

        <Field label={t("warehouse")} required>
          {fixedWarehouse ? (
            <Input
              readOnly
              value={`${fixedWarehouse.code} — ${fixedWarehouse.name}`}
              className="bg-surface-2 text-muted"
            />
          ) : (
            <Select name="originWarehouseId" required defaultValue="">
              <option value="" disabled>
                —
              </option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} — {w.name}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label={t("receiptFiles")}>
          <input
            name="files"
            type="file"
            multiple
            accept="image/*,.pdf,.xls,.xlsx,.doc,.docx"
            className={cn(
              controlCls,
              "file:mr-3 file:h-full file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-primary",
              "flex items-center py-0",
            )}
          />
        </Field>
      </div>

      {/* Qatorlar: har xil tovar alohida */}
      <div className="mt-5 space-y-4">
        {lines.map((l, i) => {
          const preview = linePreview(l);
          return (
            <div
              key={i}
              className="rounded-xl border border-line bg-surface-2/40 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-bold tracking-wider text-muted uppercase">
                  {t("line")} {i + 1}
                </span>
                <div className="flex items-center gap-4">
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-muted">
                    <input
                      type="checkbox"
                      checked={l.manual}
                      onChange={(e) => setLine(i, { manual: e.target.checked })}
                      className="h-4 w-4 accent-[var(--primary)]"
                    />
                    {t("manualTotals")}
                  </label>
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setLines((prev) => prev.filter((_, j) => j !== i))
                      }
                      className="text-xs font-medium text-red-500 hover:underline"
                    >
                      {tc("delete")}
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field
                  label={t("product")}
                  required
                  className="sm:col-span-2"
                >
                  <Input
                    required
                    value={l.productName}
                    onChange={(e) =>
                      setLine(i, { productName: e.target.value })
                    }
                  />
                </Field>

                <Field label={t("boxCount")} required>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    required
                    value={l.boxCount}
                    onChange={(e) => setLine(i, { boxCount: e.target.value })}
                  />
                </Field>

                <Field label={t("linePhotos")}>
                  <input
                    name={`linePhotos_${i}`}
                    type="file"
                    multiple
                    accept="image/*"
                    className={cn(
                      controlCls,
                      "file:mr-3 file:h-full file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-primary",
                      "flex items-center py-0",
                    )}
                  />
                </Field>

                {l.manual ? (
                  <>
                    <Field label={t("totalWeight")} required>
                      <Input
                        type="number"
                        min="0.001"
                        step="0.001"
                        inputMode="decimal"
                        required
                        value={l.totalWeightKg}
                        onChange={(e) =>
                          setLine(i, { totalWeightKg: e.target.value })
                        }
                      />
                    </Field>
                    <Field label={t("totalVolume")} required>
                      <Input
                        type="number"
                        min="0.0001"
                        step="0.0001"
                        inputMode="decimal"
                        required
                        value={l.totalVolumeM3}
                        onChange={(e) =>
                          setLine(i, { totalVolumeM3: e.target.value })
                        }
                      />
                    </Field>
                  </>
                ) : (
                  <>
                    <Field label={t("boxDims")} required className="sm:col-span-2">
                      <div className="flex items-center gap-1.5">
                        {(
                          ["boxLengthCm", "boxWidthCm", "boxHeightCm"] as const
                        ).map((k, di) => (
                          <span key={k} className="flex flex-1 items-center gap-1.5">
                            {di > 0 && (
                              <span className="text-xs text-muted">×</span>
                            )}
                            <Input
                              type="number"
                              min="0.1"
                              step="0.1"
                              inputMode="decimal"
                              required
                              value={l[k]}
                              onChange={(e) =>
                                setLine(i, { [k]: e.target.value })
                              }
                              className="min-w-0 px-2 text-center"
                            />
                          </span>
                        ))}
                      </div>
                    </Field>
                    <Field label={t("weightPerBox")} required>
                      <Input
                        type="number"
                        min="0.001"
                        step="0.001"
                        inputMode="decimal"
                        required
                        value={l.weightPerBoxKg}
                        onChange={(e) =>
                          setLine(i, { weightPerBoxKg: e.target.value })
                        }
                      />
                    </Field>
                  </>
                )}
              </div>

              {preview && (
                <p className="mt-3 text-xs font-medium text-muted">
                  = {preview.kg ? `${+preview.kg.toFixed(3)} kg` : "—"} ·{" "}
                  {preview.m3 ? `${+preview.m3.toFixed(4)} m³` : "—"}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setLines((prev) => [...prev, emptyLine()])}
        >
          + {t("addLine")}
        </Button>
        {totals.boxes > 0 && (
          <span className="font-mono text-xs font-semibold text-muted tabular-nums">
            Σ {totals.boxes} · {+totals.kg.toFixed(3)} kg ·{" "}
            {+totals.m3.toFixed(4)} m³
          </span>
        )}
      </div>

      {state.error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {t("saveError")}
        </p>
      )}
      {state.createdReg && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          {t("received", { reg: state.createdReg })}
        </p>
      )}

      <Button type="submit" disabled={pending} className="mt-4">
        {pending ? tc("loading") : t("receive")}
      </Button>
    </form>
  );
}
