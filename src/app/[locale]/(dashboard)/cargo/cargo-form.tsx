"use client";

import { useActionState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { receiveCargoAction, type CargoFormState } from "./actions";

const inputCls =
  "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900";

type Option = { id: string; code: string; name: string };

export function CargoForm({
  clients,
  warehouses,
  fixedWarehouseId,
}: {
  clients: Option[];
  warehouses: Option[];
  // Sklad xodimi uchun: sklad tanlanmaydi, o'ziniki qotirilgan
  fixedWarehouseId: string | null;
}) {
  const t = useTranslations("cargo");
  const tc = useTranslations("common");
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<CargoFormState, FormData>(
    receiveCargoAction,
    {},
  );

  useEffect(() => {
    if (state.createdReg) formRef.current?.reset();
  }, [state.createdReg]);

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
          {t("pieces")} *
          <input
            name="pieces"
            type="number"
            min="1"
            step="1"
            required
            className={inputCls}
          />
        </label>

        <label className="block text-sm font-medium">
          {t("weightKg")} *
          <input
            name="weightKg"
            type="number"
            min="0.001"
            step="0.001"
            required
            className={inputCls}
          />
        </label>

        <label className="block text-sm font-medium">
          {t("volumeM3")} *
          <input
            name="volumeM3"
            type="number"
            min="0.0001"
            step="0.0001"
            required
            className={inputCls}
          />
        </label>

        <label className="block text-sm font-medium">
          {t("description")}
          <input name="description" className={inputCls} />
        </label>
      </div>

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
