"use client";

import { useActionState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { createUserAction, type UserFormState } from "./actions";

const inputCls =
  "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900";

type RoleOption = { code: string; name: string };
type WarehouseOption = { id: string; code: string; name: string };

export function UserForm({
  roles,
  warehouses,
}: {
  roles: RoleOption[];
  warehouses: WarehouseOption[];
}) {
  const t = useTranslations("users");
  const tc = useTranslations("common");
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<UserFormState, FormData>(
    createUserAction,
    {},
  );

  useEffect(() => {
    if (state.createdUsername) formRef.current?.reset();
  }, [state.createdUsername]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-lg border border-gray-200 p-4 dark:border-gray-700"
    >
      <h2 className="font-semibold">{t("newUser")}</h2>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block text-sm font-medium">
          {t("username")} *
          <input
            name="username"
            required
            pattern="[a-zA-Z0-9_.\-]{3,64}"
            autoComplete="off"
            className={inputCls}
          />
        </label>
        <label className="block text-sm font-medium">
          {t("fullName")} *
          <input name="fullName" required minLength={2} className={inputCls} />
        </label>
        <label className="block text-sm font-medium">
          {t("password")} *
          <input
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            className={inputCls}
          />
        </label>
        <label className="block text-sm font-medium">
          {t("role")} *
          <select name="roleCode" required className={inputCls} defaultValue="">
            <option value="" disabled>
              —
            </option>
            {roles.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          {t("warehouse")}
          <select name="warehouseId" className={inputCls} defaultValue="">
            <option value="">{t("noWarehouse")}</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} — {w.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {state.error && (
        <p className="mt-3 text-sm text-red-600">
          {state.error === "usernameTaken" ? t("usernameTaken") : t("saveError")}
        </p>
      )}
      {state.createdUsername && (
        <p className="mt-3 text-sm text-green-600">
          {t("created", { username: state.createdUsername })}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? tc("loading") : tc("create")}
      </button>
    </form>
  );
}
