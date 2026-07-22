"use client";

import { useActionState, useRef, useEffect, useState, startTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Button, Input, Select, Field, controlCls, cn } from "@/components/ui";
import { icons } from "@/components/icons";
import { receiveCargoAction, type CargoFormState } from "./actions";
import { translateProductNameAction } from "./translate-action";
import { compressImages } from "@/components/image-compress";

type Option = { id: string; code: string; name: string };

type Line = {
  productName: string;
  boxCount: string;
  boxLengthCm: string;
  boxWidthCm: string;
  boxHeightCm: string;
  weightPerBoxKg: string;
  totalWeightKg: string;
  totalVolumeM3: string;
  manual: boolean; // o'lchab bo'lmagan: umumiy kg/kub qo'lda
  photos: File[]; // qator (tovar) rasmlari — yuborishdan oldin siqiladi
};

export type InitialCargoLine = {
  productName: string;
  boxCount: number;
  boxLengthCm?: string | null;
  boxWidthCm?: string | null;
  boxHeightCm?: string | null;
  weightPerBoxKg?: string | null;
  totalWeightKg: string;
  totalVolumeM3: string;
};

const emptyLine = (): Line => ({
  productName: "",
  boxCount: "",
  boxLengthCm: "",
  boxWidthCm: "",
  boxHeightCm: "",
  weightPerBoxKg: "",
  totalWeightKg: "",
  totalVolumeM3: "",
  manual: false,
  photos: [],
});

function lineFromInitial(l: InitialCargoLine): Line {
  const manual = l.boxLengthCm == null;
  return {
    productName: l.productName,
    boxCount: String(l.boxCount),
    boxLengthCm: l.boxLengthCm ?? "",
    boxWidthCm: l.boxWidthCm ?? "",
    boxHeightCm: l.boxHeightCm ?? "",
    weightPerBoxKg: l.weightPerBoxKg ?? "",
    totalWeightKg: manual ? l.totalWeightKg : "",
    totalVolumeM3: manual ? l.totalVolumeM3 : "",
    manual,
    photos: [],
  };
}

function lineToPayload(l: Line) {
  return {
    productName: l.productName,
    boxCount: l.boxCount,
    ...(l.manual
      ? { totalWeightKg: l.totalWeightKg, totalVolumeM3: l.totalVolumeM3 }
      : {
          boxLengthCm: l.boxLengthCm,
          boxWidthCm: l.boxWidthCm,
          boxHeightCm: l.boxHeightCm,
          weightPerBoxKg: l.weightPerBoxKg,
        }),
  };
}

/** Qator jamini jonli ko'rsatish uchun hisob. */
function linePreview(l: Line): { kg: number; m3: number } | null {
  const count = Number(l.boxCount);
  if (!count) return null;
  if (l.manual) {
    const kg = Number(l.totalWeightKg);
    const m3 = Number(l.totalVolumeM3);
    return kg || m3 ? { kg, m3 } : null;
  }
  const kg = Number(l.weightPerBoxKg) * count;
  const L = Number(l.boxLengthCm),
    W = Number(l.boxWidthCm),
    H = Number(l.boxHeightCm);
  const m3 = L && W && H ? ((L * W * H) / 1_000_000) * count : 0;
  return kg || m3 ? { kg, m3 } : null;
}

/** Kichik, kamtarona "rasm qo'shish" tugmasi — to'liq inputga qaraganda ancha ixcham.
 *  Tanlangan fayllar state'da saqlanadi (yuborishdan oldin siqiladi). */
function PhotoPicker({
  label,
  files,
  onFiles,
}: {
  label: string;
  files: File[];
  onFiles: (files: File[]) => void;
}) {
  // <label> ichidagi input — mobil brauzerlarda tugma orqali dasturiy click'dan
  // ko'ra ishonchli (native tap file dialogni ochadi).
  return (
    <label className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-line px-2.5 text-xs font-medium text-muted transition-colors hover:bg-surface-2 hover:text-foreground">
      <input
        type="file"
        multiple
        accept="image/*"
        className="sr-only"
        onChange={(e) => onFiles(Array.from(e.target.files ?? []))}
      />
      {icons.camera("h-3.5 w-3.5")}
      {label}
      {files.length > 0 && (
        <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold text-white">
          {files.length}
        </span>
      )}
    </label>
  );
}

/** Mijozni qidirib tanlash: matn kiritilganda mos keluvchilar ro'yxati ochiladi. */
function ClientCombobox({
  clients,
  value,
  onChange,
  hasError,
}: {
  clients: Option[];
  value: string;
  onChange: (id: string) => void;
  hasError?: boolean;
}) {
  const t = useTranslations("cargo");
  const selected = clients.find((c) => c.id === value);
  const [query, setQuery] = useState(
    selected ? `${selected.code} — ${selected.name}` : "",
  );
  const [open, setOpen] = useState(false);

  const filtered = query.trim()
    ? clients.filter((c) =>
        `${c.code} ${c.name}`.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : clients;

  function selectClient(c: Option) {
    onChange(c.id);
    setQuery(`${c.code} — ${c.name}`);
    setOpen(false);
  }

  return (
    <div className="relative">
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (value) onChange("");
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={t("searchClient")}
        autoComplete="off"
        className={hasError ? "border-red-400" : undefined}
      />
      {open && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-line bg-surface py-1 shadow-lg">
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted">{t("noClients")}</li>
          )}
          {filtered.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectClient(c)}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-surface-2"
              >
                <span className="font-mono font-semibold">{c.code}</span>{" "}
                <span className="text-muted">{c.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CargoForm({
  clients,
  warehouses,
  fixedWarehouseId,
  cargoId,
  initialClientId,
  initialWarehouseId,
  initialNote,
  initialLines,
}: {
  clients: Option[];
  warehouses: Option[];
  fixedWarehouseId: string | null;
  cargoId?: string;
  initialClientId?: string;
  initialWarehouseId?: string;
  initialNote?: string;
  initialLines?: InitialCargoLine[];
}) {
  const t = useTranslations("cargo");
  const tc = useTranslations("common");
  const locale = useLocale();
  const isEdit = Boolean(cargoId);
  const formRef = useRef<HTMLFormElement>(null);
  const [lines, setLines] = useState<Line[]>(
    initialLines?.length ? initialLines.map(lineFromInitial) : [emptyLine()],
  );
  const [translatingIdx, setTranslatingIdx] = useState<number | null>(null);
  const [clientId, setClientId] = useState(initialClientId ?? "");
  const [clientError, setClientError] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [warehouseId, setWarehouseId] = useState(initialWarehouseId ?? "");
  const [receiptFiles, setReceiptFiles] = useState<File[]>([]);
  const [preparing, setPreparing] = useState(false); // rasmlarni siqish jarayoni
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [state, formAction, pending] = useActionState<CargoFormState, FormData>(
    receiveCargoAction,
    {},
  );

  // Muvaffaqiyatli qabul (tashqi hodisa — server javobi) dan keyin formani
  // tozalash: shu hodisaga sinxronlanadi.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (state.createdReg && !isEdit) {
      formRef.current?.reset();
      setLines([emptyLine()]);
      setClientId("");
      setWarehouseId("");
      setReceiptFiles([]);
      setResetKey((k) => k + 1);
    }
  }, [state.createdReg, isEdit]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /**
   * Yuborish: rasmlarni brauzerda siqib, FormData ni qo'lda yig'amiz.
   * (Siqish server action body limitiga urilmaslik + bazani yengil tutish uchun.)
   */
  async function submitCompressed() {
    setConfirmOpen(false);
    setPreparing(true);
    try {
      const fd = new FormData();
      if (cargoId) fd.set("cargoId", cargoId);
      fd.set("clientId", clientId);
      fd.set("originWarehouseId", warehouseId);
      fd.set("note", initialNote ?? "");
      fd.set("linesJson", JSON.stringify(lines.map(lineToPayload)));

      const receipts = await compressImages(receiptFiles);
      for (const f of receipts) fd.append("files", f);

      for (let i = 0; i < lines.length; i++) {
        const photos = await compressImages(lines[i].photos);
        for (const p of photos) fd.append(`linePhotos_${i}`, p);
      }
      // useActionState dispatchini transition ichida chaqiramiz — aks holda
      // `pending` (isPending) to'g'ri yangilanmaydi (brauzer ogohlantirishi).
      startTransition(() => formAction(fd));
    } finally {
      setPreparing(false);
    }
  }

  const setLine = (i: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  async function handleProductBlur(i: number) {
    const name = lines[i].productName;
    if (!name.trim() || name.includes("(")) return;
    setTranslatingIdx(i);
    const translated = await translateProductNameAction(name, locale);
    setTranslatingIdx(null);
    if (translated) {
      setLine(i, { productName: `${name} (${translated})` });
    }
  }

  const fixedWarehouse = fixedWarehouseId
    ? warehouses.find((w) => w.id === fixedWarehouseId)
    : null;

  const totals = lines.reduce(
    (acc, l) => {
      const p = linePreview(l);
      if (p) {
        acc.kg += p.kg;
        acc.m3 += p.m3;
        acc.boxes += Number(l.boxCount) || 0;
      }
      return acc;
    },
    { boxes: 0, kg: 0, m3: 0 },
  );

  const selectedClient = clients.find((c) => c.id === clientId);

  function handleReviewClick() {
    if (!clientId) {
      setClientError(true);
      return;
    }
    if (!formRef.current?.reportValidity()) return;
    setConfirmOpen(true);
  }

  return (
    <form ref={formRef} onSubmit={(e) => e.preventDefault()}>
      {/* Prixod sarlavhasi */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label={t("client")} required>
          <ClientCombobox
            key={resetKey}
            clients={clients}
            value={clientId}
            hasError={clientError}
            onChange={(id) => {
              setClientId(id);
              if (id) setClientError(false);
            }}
          />
          {clientError && (
            <p className="mt-1 text-xs text-red-500">{t("clientRequired")}</p>
          )}
        </Field>

        <Field label={t("warehouse")} required>
          {fixedWarehouse ? (
            <Input
              readOnly
              value={`${fixedWarehouse.code} — ${fixedWarehouse.name}`}
              className="bg-surface-2 text-muted"
            />
          ) : (
            <Select
              name="originWarehouseId"
              required
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
            >
              <option value="" disabled>
                —
              </option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} — {w.name}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label={t("receiptFiles")}>
          <input
            type="file"
            multiple
            accept="image/*,.pdf,.xls,.xlsx,.doc,.docx"
            onChange={(e) => setReceiptFiles(Array.from(e.target.files ?? []))}
            className={cn(
              controlCls,
              "file:mr-3 file:h-full file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-primary",
              "flex items-center py-0",
            )}
          />
        </Field>
      </div>

      {/* Qatorlar: har xil tovar alohida. Barcha maydonlar bitta qatorda. */}
      <div className="mt-5 space-y-3">
        {lines.map((l, i) => {
          const preview = linePreview(l);
          return (
            <div
              key={i}
              className="rounded-xl border border-line bg-surface-2/40 p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
                <span className="text-[11px] font-bold tracking-wider text-muted uppercase">
                  {t("line")} {i + 1}
                </span>
                <div className="flex items-center gap-4">
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-muted">
                    <input
                      type="checkbox"
                      checked={l.manual}
                      onChange={(e) => setLine(i, { manual: e.target.checked })}
                      className="h-4 w-4 accent-[var(--primary)]"
                    />
                    {t("manualTotals")}
                  </label>
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setLines((prev) => prev.filter((_, j) => j !== i))
                      }
                      className="text-xs font-medium text-red-500 hover:underline"
                    >
                      {tc("delete")}
                    </button>
                  )}
                </div>
              </div>

              {/*
                Qator maketi: qat'iy CSS Grid ustunlar (flex-wrap emas) —
                nomi maydoniga necha harf yozilmasin yoki o'lchamsiz
                rejimi almashtirilsin, boshqa ustunlar joyidan siljimaydi.
                Ustun 3-4 ("o'lcham" slot) ikkala rejimda ham bir xil
                kenglikda qoladi — faqat ichidagi maydon almashadi.
              */}
              <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-[minmax(160px,2fr)_80px_minmax(150px,1fr)_92px_auto]">
                <div className="relative col-span-2 sm:col-span-1">
                  <Field label={t("product")} required>
                    <Input
                      required
                      value={l.productName}
                      onChange={(e) =>
                        setLine(i, { productName: e.target.value })
                      }
                      onBlur={() => handleProductBlur(i)}
                    />
                  </Field>
                  {translatingIdx === i && (
                    <span className="absolute top-2 right-3 text-xs text-muted">
                      {t("translating")}
                    </span>
                  )}
                </div>

                <Field label={t("boxCount")} required>
                  <Input
                    type="text"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    required
                    value={l.boxCount}
                    onChange={(e) => setLine(i, { boxCount: e.target.value })}
                  />
                </Field>

                {l.manual ? (
                  <Field label={t("totalWeight")} required>
                    <Input
                      type="text"
                      min="0.001"
                      step="0.001"
                      inputMode="decimal"
                      required
                      value={l.totalWeightKg}
                      onChange={(e) =>
                        setLine(i, { totalWeightKg: e.target.value })
                      }
                    />
                  </Field>
                ) : (
                  <Field label={t("boxDims")} required>
                    <div className="flex items-center gap-1">
                      {(
                        ["boxLengthCm", "boxWidthCm", "boxHeightCm"] as const
                      ).map((k, di) => (
                        <span key={k} className="flex flex-1 items-center gap-1">
                          {di > 0 && <span className="text-xs text-muted">×</span>}
                          <Input
                            type="text"
                            min="0.1"
                            step="0.1"
                            inputMode="decimal"
                            required
                            value={l[k]}
                            onChange={(e) =>
                              setLine(i, { [k]: e.target.value })
                            }
                            className="min-w-0 px-1.5 text-center"
                          />
                        </span>
                      ))}
                    </div>
                  </Field>
                )}

                {l.manual ? (
                  <Field label={t("totalVolume")} required>
                    <Input
                      type="text"
                      min="0.0001"
                      step="0.0001"
                      inputMode="decimal"
                      required
                      value={l.totalVolumeM3}
                      onChange={(e) =>
                        setLine(i, { totalVolumeM3: e.target.value })
                      }
                    />
                  </Field>
                ) : (
                  <Field label={t("weightPerBox")} required>
                    <Input
                      type="text"
                      min="0.001"
                      step="0.001"
                      inputMode="decimal"
                      required
                      value={l.weightPerBoxKg}
                      onChange={(e) =>
                        setLine(i, { weightPerBoxKg: e.target.value })
                      }
                    />
                  </Field>
                )}

                <div className="col-span-2 flex items-center justify-between gap-3 sm:col-span-1 sm:justify-end">
                  <PhotoPicker
                    label={t("linePhotos")}
                    files={l.photos}
                    onFiles={(photos) => setLine(i, { photos })}
                  />
                </div>
              </div>

              {preview && (
                <p className="mt-2 text-right font-mono text-xs font-medium text-muted tabular-nums">
                  = {preview.kg ? `${+preview.kg.toFixed(3)} kg` : "—"} ·{" "}
                  {preview.m3 ? `${+preview.m3.toFixed(4)} m³` : "—"}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setLines((prev) => [...prev, emptyLine()])}
        >
          + {t("addLine")}
        </Button>
        {totals.boxes > 0 && (
          <span className="font-mono text-xs font-semibold text-muted tabular-nums">
            Σ {totals.boxes} · {+totals.kg.toFixed(3)} kg ·{" "}
            {+totals.m3.toFixed(4)} m³
          </span>
        )}
      </div>

      {state.error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error === "cargoLocked" ? t("cargoLocked") : t("saveError")}
        </p>
      )}
      {state.createdReg && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          {isEdit
            ? t("updated", { reg: state.createdReg })
            : t("received", { reg: state.createdReg })}
        </p>
      )}

      <Button
        type="button"
        onClick={handleReviewClick}
        disabled={pending || preparing}
        className="mt-4"
      >
        {preparing
          ? t("compressing")
          : pending
            ? tc("loading")
            : isEdit
              ? t("saveChanges")
              : t("receive")}
      </Button>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal
        >
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-line bg-surface p-5 shadow-xl">
            <h3 className="text-base font-bold">{t("confirmTitle")}</h3>

            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
              <dt className="text-muted">{t("client")}</dt>
              <dd className="text-right font-medium">
                {selectedClient
                  ? `${selectedClient.code} — ${selectedClient.name}`
                  : "—"}
              </dd>
              <dt className="text-muted">{t("warehouse")}</dt>
              <dd className="text-right font-medium">
                {fixedWarehouse?.code ??
                  warehouses.find((w) => w.id === warehouseId)?.code ??
                  "—"}
              </dd>
            </dl>

            <div className="mt-3 space-y-1.5 border-t border-line pt-3">
              {lines.map((l, i) => {
                const p = linePreview(l);
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="truncate pr-2">
                      {l.productName || "—"}{" "}
                      <span className="text-muted">× {l.boxCount || 0}</span>
                    </span>
                    <span className="shrink-0 font-mono text-xs text-muted tabular-nums">
                      {p ? `${+p.kg.toFixed(2)} kg · ${+p.m3.toFixed(3)} m³` : "—"}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-sm font-semibold">
              <span>Σ {totals.boxes}</span>
              <span className="font-mono tabular-nums">
                {+totals.kg.toFixed(3)} kg · {+totals.m3.toFixed(4)} m³
              </span>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmOpen(false)}
              >
                {t("confirmCancel")}
              </Button>
              <Button type="button" onClick={submitCompressed}>
                {t("confirmSubmit")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
