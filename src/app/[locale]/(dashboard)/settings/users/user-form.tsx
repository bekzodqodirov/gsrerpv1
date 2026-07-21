"use client";

import { useActionState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button, Input, Select, Field } from "@/components/ui";
import { createUserAction, type UserFormState } from "./actions";

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
    <form ref={formRef} action={formAction}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label={t("username")} required>
          <Input
            name="username"
            required
            pattern="[a-zA-Z0-9_.\-]{3,64}"
            autoComplete="off"
            className="font-mono"
          />
        </Field>
        <Field label={t("fullName")} required>
          <Input name="fullName" required minLength={2} />
        </Field>
        <Field label={t("password")} required>
          <Input
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
          />
        </Field>
        <Field label={t("role")} required>
          <Select name="roleCode" required defaultValue="">
            <option value="" disabled>
              —
            </option>
            {roles.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("warehouse")}>
          <Select name="warehouseId" defaultValue="">
            <option value="">{t("noWarehouse")}</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} — {w.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {state.error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error === "usernameTaken" ? t("usernameTaken") : t("saveError")}
        </p>
      )}
      {state.createdUsername && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          {t("created", { username: state.createdUsername })}
        </p>
      )}

      <Button type="submit" disabled={pending} className="mt-4">
        {pending ? tc("loading") : tc("create")}
      </Button>
    </form>
  );
}
