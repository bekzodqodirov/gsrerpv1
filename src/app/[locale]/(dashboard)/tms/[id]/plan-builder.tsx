"use client";

// Plan tuzuvchi (logist): ombordagi TOVARLAR ro'yxatidan tanlaydi — rasm, nom,
// o'lchamlar to'liq ko'rinadi. Har tovardan nechta karobka olishni yozadi va
// pastdagi jonli hisobda tanlov qo'shilganda mashina qancha to'lishini KO'RADI
// ("qaysi tovardan qancha yuklasa hohlagan natijaga kelishi").
import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui";
import { icons } from "@/components/icons";
import { PhotoThumbs } from "@/components/photo-lightbox";
import { addPlanLinesAction } from "../actions";

export type AvailableLine = {
  lineId: string;
  cargoId: string;
  regNumber: string;
  zone: string | null;
  letterCode: string;
  productName: string;
  clientCode: string;
  clientName: string;
  boxCount: number;
  availableBoxes: number;
  plannedThisBatch: number;
  perBoxKg: number;
  perBoxM3: number;
  photoId: string | null;
};

export function PlanBuilder({
  batchId,
  lines,
  planKg,
  planM3,
  capKg,
  capM3,
}: {
  batchId: string;
  lines: AvailableLine[];
  planKg: number;
  planM3: number;
  capKg: number | null;
  capM3: number | null;
}) {
  const t = useTranslations("tms");
  const router = useRouter();
  const [qty, setQty] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const ql = q.trim().toLowerCase();
  const shown = useMemo(
    () =>
      ql
        ? lines.filter((l) =>
            `${l.clientCode} ${l.clientName} ${l.productName} ${l.letterCode} ${l.regNumber} ${l.zone ?? ""}`
              .toLowerCase()
              .includes(ql),
          )
        : lines,
    [lines, ql],
  );

  // Tanlov (0 < qty <= available):
  const selection = useMemo(() => {
    const items: { lineId: string; boxes: number; kg: number; m3: number }[] = [];
    for (const l of lines) {
      const raw = qty[l.lineId];
      if (raw == null || raw === "") continue;
      const n = Math.floor(Number(raw));
      if (!Number.isFinite(n) || n < 1) continue;
      const boxes = Math.min(n, l.availableBoxes);
      items.push({
        lineId: l.lineId,
        boxes,
        kg: boxes * l.perBoxKg,
        m3: boxes * l.perBoxM3,
      });
    }
    return items;
  }, [qty, lines]);

  const selKg = selection.reduce((s, i) => s + i.kg, 0);
  const selM3 = selection.reduce((s, i) => s + i.m3, 0);
  const selBoxes = selection.reduce((s, i) => s + i.boxes, 0);

  function submit() {
    if (selection.length === 0) return;
    setError(null);
    startTransition(async () => {
      const res = await addPlanLinesAction(
        batchId,
        selection.map((s) => ({ lineId: s.lineId, boxes: s.boxes })),
      );
      if (res.error) {
        setError(res.error);
      } else {
        setQty({});
        router.refresh();
      }
    });
  }

  const fmt = (n: number, d = 1) =>
    new Intl.NumberFormat("ru-RU", { maximumFractionDigits: d }).format(n);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-muted">{t("planBuilder")}</h2>
        <div className="relative w-full sm:w-64">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("searchProduct")}
            className="h-9 w-full rounded-lg border border-line bg-surface pr-3 pl-8 text-sm outline-none focus:border-primary"
          />
          <span className="pointer-events-none absolute top-2.5 left-2.5 text-muted">
            {icons.search("h-4 w-4")}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead className="bg-surface-2/60 text-left">
            <tr>
              <th className="px-3 py-2 font-semibold">{t("photo")}</th>
              <th className="px-3 py-2 font-semibold">{t("zone")}</th>
              <th className="px-3 py-2 font-semibold">{t("product")}</th>
              <th className="px-3 py-2 text-right font-semibold">
                {t("availableCol")}
              </th>
              <th className="px-3 py-2 text-right font-semibold">
                {t("perBox")}
              </th>
              <th className="px-3 py-2 text-right font-semibold">{t("qty")}</th>
              <th className="px-3 py-2 text-right font-semibold">
                {t("selectionTotal")}
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted">
                  {t("noAvailable")}
                </td>
              </tr>
            ) : (
              shown.map((l) => {
                const raw = qty[l.lineId] ?? "";
                const n = Math.min(
                  Math.max(Math.floor(Number(raw)) || 0, 0),
                  l.availableBoxes,
                );
                return (
                  <tr key={l.lineId} className="border-t border-line/60">
                    <td className="px-3 py-1.5">
                      {l.photoId ? (
                        <PhotoThumbs
                          photos={[{ id: l.photoId, name: l.productName }]}
                          thumbClass="h-11 w-11"
                        />
                      ) : (
                        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-surface-2 text-muted">
                          {icons.camera("h-4 w-4")}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      {l.zone ? (
                        <span className="rounded-md bg-primary-soft px-2 py-0.5 font-mono text-xs font-bold text-primary">
                          {l.zone}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="font-mono text-sm font-black">
                        {l.clientCode}-{l.letterCode}
                      </div>
                      <div className="max-w-56 truncate text-sm">{l.productName}</div>
                      <div className="font-mono text-[11px] text-muted">
                        {l.regNumber}
                        {l.plannedThisBatch > 0 &&
                          ` · ${t("inPlanN", { n: l.plannedThisBatch })}`}
                      </div>
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                      {l.availableBoxes}
                      <span className="text-muted">/{l.boxCount}</span>
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-xs tabular-nums text-muted">
                      {fmt(l.perBoxKg, 2)} kg
                      <br />
                      {fmt(l.perBoxM3, 4)} m³
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={raw}
                          onChange={(e) =>
                            setQty((prev) => ({
                              ...prev,
                              [l.lineId]: e.target.value.replace(/\D/g, ""),
                            }))
                          }
                          placeholder="0"
                          className="h-9 w-16 rounded-lg border border-line bg-surface px-2 text-center font-mono text-sm outline-none focus:border-primary"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setQty((prev) => ({
                              ...prev,
                              [l.lineId]: String(l.availableBoxes),
                            }))
                          }
                          className="rounded-md px-1.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary-soft"
                          title={t("allBoxes")}
                        >
                          {t("allBoxes")}
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-xs tabular-nums">
                      {n > 0 ? (
                        <>
                          <span className="font-semibold">{fmt(n * l.perBoxKg, 1)} kg</span>
                          <br />
                          {fmt(n * l.perBoxM3, 3)} m³
                        </>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Jonli natija: plan + tanlov = mashina qancha to'ladi */}
      <div className="sticky bottom-2 rounded-xl border border-line bg-surface p-3 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <span className="font-semibold">{t("projection")}:</span>{" "}
            <span className="font-mono tabular-nums">
              {selBoxes > 0 ? `+${selBoxes} ${t("boxesShort")} · ` : ""}
              {fmt(planKg + selKg, 1)}
              {capKg ? ` / ${fmt(capKg, 0)}` : ""} kg ·{" "}
              {fmt(planM3 + selM3, 2)}
              {capM3 ? ` / ${fmt(capM3, 1)}` : ""} m³
            </span>
            {capKg && planKg + selKg > capKg && (
              <span className="ml-2 font-semibold text-red-600">
                {t("overCapacity")}
              </span>
            )}
            {capM3 && planM3 + selM3 > capM3 && !(capKg && planKg + selKg > capKg) && (
              <span className="ml-2 font-semibold text-red-600">
                {t("overCapacity")}
              </span>
            )}
          </div>
          <Button
            type="button"
            onClick={submit}
            disabled={pending || selection.length === 0}
          >
            {pending ? "…" : t("addSelected", { n: selection.length })}
          </Button>
        </div>
        {error && (
          <p className="mt-2 text-sm text-red-600">
            {error === "exceedsAvailable"
              ? t("exceedsAvailable")
              : error === "belowScanned"
                ? t("belowScanned")
                : t("saveError")}
          </p>
        )}
      </div>
    </div>
  );
}
