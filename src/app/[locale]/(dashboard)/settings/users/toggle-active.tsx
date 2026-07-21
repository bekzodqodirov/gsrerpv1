"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toggleUserActiveAction } from "./actions";

export function ToggleActive({
  id,
  isActive,
  disabled,
}: {
  id: string;
  isActive: boolean;
  disabled: boolean;
}) {
  const t = useTranslations("users");
  const [pending, startTransition] = useTransition();

  if (disabled) return null;

  return (
    <button
      onClick={() => startTransition(() => toggleUserActiveAction(id, !isActive))}
      disabled={pending}
      className="text-xs text-blue-600 hover:underline disabled:opacity-50 dark:text-blue-400"
    >
      {isActive ? t("deactivate") : t("activate")}
    </button>
  );
}
