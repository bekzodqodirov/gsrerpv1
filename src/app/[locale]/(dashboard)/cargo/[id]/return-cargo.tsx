"use client";

// Yukni "qaytarildi" deb belgilash — sabab so'raladi, tasdiqdan keyin yuk
// ombordan chiqadi (qoldiqda ko'rinmaydi).
import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui";
import { returnCargoAction, type ReturnState } from "../actions";

export function ReturnCargo({ cargoId }: { cargoId: string }) {
  const t = useTranslations("cargo");
  const tc = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ReturnState, FormData>(
    returnCargoAction.bind(null, cargoId),
    {},
  );

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (state.done) {
      setOpen(false);
      router.refresh();
    }
  }, [state.done, router]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="text-red-600">
        ↩ {t("returnCargo")}
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !pending && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-surface p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold">{t("returnTitle")}</h3>
            <p className="mt-1 text-sm text-muted">{t("returnHint")}</p>
            <form action={formAction} className="mt-4 space-y-3">
              <textarea
                name="reason"
                rows={3}
                autoFocus
                placeholder={t("returnReason")}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
              {state.error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                  {state.error === "notReturnable"
                    ? t("notReturnable")
                    : state.error === "notHere"
                      ? t("notHere")
                      : tc("loading")}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                >
                  {tc("cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={pending}
                  className="bg-red-600 text-white hover:bg-red-700"
                >
                  {pending ? "…" : t("returnConfirm")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
