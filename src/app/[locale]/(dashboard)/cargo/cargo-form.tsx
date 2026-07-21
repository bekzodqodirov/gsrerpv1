"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { receiveCargoAction, type CargoFormState } from "./actions";

const inputCls =
  "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900";

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

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-lg border border-gray-200 p-4 dark:border-gray-700"
    >
      <h2 className="font-semibold">{t("newCargo")}</h2>

      <input
        type="hidden"
        name="linesJson"
        value={JSON.stringify(lines.map(lineToPayload))}
      />

      {/* Prixod sarlavhasi */}
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block text-sm font-medium">
          {t("client")} *
          <select name="clientId" required className={inputCls} defaultValue="">
            <option value="" disabled>
              —
            </option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium">
          {t("warehouse")} *
          {fixedWarehouse ? (
            <input
              readOnly
              value={`${fixedWarehouse.code} — ${fixedWarehouse.name}`}
              className={`${inputCls} bg-gray-100 dark:bg-gray-800`}
            />
          ) : (
            <select
              name="originWarehouseId"
              required
              className={inputCls}
              defaultValue=""
            >
              <option value="" disabled>
                —
              </option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} — {w.name}
                </option>
              ))}
            </select>
          )}
        </label>

        <label className="block text-sm font-medium">
          {t("receiptFiles")}
          <input
            name="files"
            type="file"
            multiple
            accept="image/*,.pdf,.xls,.xlsx,.doc,.docx"
            className={inputCls}
          />
        </label>
      </div>

      {/* Qatorlar: har xil tovar alohida */}
      <div className="mt-4 space-y-4">
        {lines.map((l, i) => (
          <div
            key={i}
            className="rounded-md border border-gray-200 p-3 dark:border-gray-700"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">
                {t("line")} {i + 1}
              </span>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={l.manual}
                    onChange={(e) => setLine(i, { manual: e.target.checked })}
                  />
                  {t("manualTotals")}
                </label>
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setLines((prev) => prev.filter((_, j) => j !== i))
                    }
                    className="text-xs text-red-600 hover:underline"
                  >
                    {tc("delete")}
                  </button>
                )}
              </div>
            </div>

            <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block text-sm font-medium lg:col-span-2">
                {t("product")} *
                <input
                  required
                  value={l.productName}
                  onChange={(e) => setLine(i, { productName: e.target.value })}
                  className={inputCls}
                />
              </label>

              <label className="block text-sm font-medium">
                {t("boxCount")} *
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={l.boxCount}
                  onChange={(e) => setLine(i, { boxCount: e.target.value })}
                  className={inputCls}
                />
              </label>

              <label className="block text-sm font-medium">
                {t("linePhotos")}
                <input
                  name={`linePhotos_${i}`}
                  type="file"
                  multiple
                  accept="image/*"
                  className={inputCls}
                />
              </label>

              {l.manual ? (
                <>
                  <label className="block text-sm font-medium">
                    {t("totalWeight")} *
                    <input
                      type="number"
                      min="0.001"
                      step="0.001"
                      required
                      value={l.totalWeightKg}
                      onChange={(e) =>
                        setLine(i, { totalWeightKg: e.target.value })
                      }
                      className={inputCls}
                    />
                  </label>
                  <label className="block text-sm font-medium">
                    {t("totalVolume")} *
                    <input
                      type="number"
                      min="0.0001"
                      step="0.0001"
                      required
                      value={l.totalVolumeM3}
                      onChange={(e) =>
                        setLine(i, { totalVolumeM3: e.target.value })
                      }
                      className={inputCls}
                    />
                  </label>
                </>
              ) : (
                <>
                  <div className="block text-sm font-medium">
                    {t("boxDims")} *
                    <div className="mt-1 flex items-center gap-1">
                      {(
                        ["boxLengthCm", "boxWidthCm", "boxHeightCm"] as const
                      ).map((k, di) => (
                        <span key={k} className="flex items-center gap-1">
                          {di > 0 && <span className="text-gray-400">×</span>}
                          <input
                            type="number"
                            min="0.1"
                            step="0.1"
                            required
                            value={l[k]}
                            onChange={(e) => setLine(i, { [k]: e.target.value })}
                            className="w-full min-w-0 rounded-md border border-gray-300 px-2 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900"
                          />
                        </span>
                      ))}
                    </div>
                  </div>
                  <label className="block text-sm font-medium">
                    {t("weightPerBox")} *
                    <input
                      type="number"
                      min="0.001"
                      step="0.001"
                      required
                      value={l.weightPerBoxKg}
                      onChange={(e) =>
                        setLine(i, { weightPerBoxKg: e.target.value })
                      }
                      className={inputCls}
                    />
                  </label>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setLines((prev) => [...prev, emptyLine()])}
        className="mt-3 rounded-md border border-dashed border-gray-400 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        + {t("addLine")}
      </button>

      {state.error && (
        <p className="mt-3 text-sm text-red-600">{t("saveError")}</p>
      )}
      {state.createdReg && (
        <p className="mt-3 text-sm text-green-600">
          {t("received", { reg: state.createdReg })}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? tc("loading") : t("receive")}
      </button>
    </form>
  );
}
