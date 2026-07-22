"use client";

// Qisman jo'natish tasdig'i: yuklanmagan karobkalar RO'YXATI ko'rsatiladi —
// ular skladda qoladi (qisman yuklangan prixodlar "qoldiq prixod"ga bo'linadi).
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import { departPartialAction } from "../actions";

export type PartialItem = {
  id: string;
  title: string; // GSR-1001-B · Tovar nomi
  loaded: number;
  planned: number;
};

export function DepartPartial({
  batchId,
  items,
  totalUnscanned,
}: {
  batchId: string;
  items: PartialItem[];
  totalUnscanned: number;
}) {
  const t = useTranslations("tms");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      await departPartialAction(batchId);
      setOpen(false);
    });
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        {t("departPartial", { n: totalUnscanned })}
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl border border-line bg-surface p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold">{t("departPartialTitle")}</h3>
            <p className="mt-1.5 text-sm text-muted">{t("departPartialNote")}</p>

            <div className="mt-3 overflow-hidden rounded-lg border border-line">
              <table className="w-full text-sm">
                <thead className="bg-surface-2/60 text-left">
                  <tr>
                    <th className="px-3 py-1.5 font-semibold">{t("product")}</th>
                    <th className="px-3 py-1.5 text-right font-semibold">
                      {t("loadedCol")}
                    </th>
                    <th className="px-3 py-1.5 text-right font-semibold">
                      {t("willStay")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.id} className="border-t border-line/60">
                      <td className="max-w-52 truncate px-3 py-1.5 text-xs font-medium">
                        {i.title}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                        {i.loaded}/{i.planned}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                        <span className="font-semibold text-amber-700 dark:text-amber-300">
                          {i.planned - i.loaded}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                {t("cancel")}
              </Button>
              <Button type="button" onClick={confirm} disabled={pending}>
                {pending ? "…" : t("departConfirm")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
