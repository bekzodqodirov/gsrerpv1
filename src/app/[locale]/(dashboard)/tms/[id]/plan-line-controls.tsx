"use client";

// Plandagi tovar sonini o'zgartirish / olib tashlash (logist).
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { icons } from "@/components/icons";
import { setPlanLineAction, removePlanLineAction } from "../actions";

export function PlanLineControls({
  batchId,
  lineId,
  planned,
  loaded,
}: {
  batchId: string;
  lineId: string;
  planned: number;
  loaded: number;
}) {
  const t = useTranslations("tms");
  const router = useRouter();
  const [value, setValue] = useState(String(planned));
  const [err, setErr] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n) || n === planned) {
      setValue(String(planned));
      return;
    }
    startTransition(async () => {
      const res = await setPlanLineAction(batchId, lineId, n);
      if (res.error) {
        setErr(true);
        setValue(String(planned));
        setTimeout(() => setErr(false), 1500);
      } else {
        router.refresh();
      }
    });
  }

  function remove() {
    startTransition(async () => {
      await removePlanLineAction(batchId, lineId);
      router.refresh();
    });
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        disabled={pending}
        className={
          "h-8 w-16 rounded-md border bg-surface px-2 text-center font-mono text-sm outline-none focus:border-primary disabled:opacity-50 " +
          (err ? "border-red-400" : "border-line")
        }
      />
      <button
        type="button"
        onClick={remove}
        disabled={pending || loaded > 0}
        title={loaded > 0 ? t("hasScans") : t("remove")}
        className="text-muted hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
      >
        {icons.close("h-4.5 w-4.5")}
      </button>
    </span>
  );
}
