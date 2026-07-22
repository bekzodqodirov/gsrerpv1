"use client";

// Qaytarilgan yukni SAQLANGAN joyidan butunlay o'chirish (voided). Tasdiq
// so'raladi — bu amalni ortga qaytarib bo'lmaydi.
import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui";
import { deleteReturnedCargoAction, type ReturnState } from "../actions";

export function DeleteReturned({ cargoId }: { cargoId: string }) {
  const t = useTranslations("cargo");
  const tc = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ReturnState, FormData>(
    deleteReturnedCargoAction.bind(null, cargoId),
    {},
  );

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (state.done) {
      setOpen(false);
      router.push("/cargo");
    }
  }, [state.done, router]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="text-red-600">
        {t("deletePermanently")}
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
            <h3 className="text-base font-semibold">{t("deletePermanently")}</h3>
            <p className="mt-1 text-sm text-muted">{t("deleteHint")}</p>
            {state.error && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                {tc("loading")}
              </p>
            )}
            <form action={formAction} className="mt-4 flex justify-end gap-2">
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
                {pending ? "…" : t("deleteConfirm")}
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
