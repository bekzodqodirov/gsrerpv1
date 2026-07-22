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
      type="button"
      onClick={() => startTransition(() => toggleUserActiveAction(id, !isActive))}
      disabled={pending}
      className="touch-manipulation text-xs font-medium text-primary hover:underline disabled:opacity-50"
    >
      {isActive ? t("deactivate") : t("activate")}
    </button>
  );
}
