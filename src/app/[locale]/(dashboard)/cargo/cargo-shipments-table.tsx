"use client";

import { Fragment, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { TableWrap, Th, Td, TRow, EmptyRow, Badge } from "@/components/ui";
import { icons } from "@/components/icons";
import { statusColors } from "@/components/cargo-status";
import { PhotoThumbs } from "@/components/photo-lightbox";
import { getLineQrPreviewAction } from "./qr-preview-action";

type Line = {
  id: string;
  lineNo: number;
  letterCode: string;
  productName: string;
  boxCount: number;
  boxLengthCm: string | null;
  boxWidthCm: string | null;
  boxHeightCm: string | null;
  weightPerBoxKg: string | null;
  totalWeightKg: string;
  totalVolumeM3: string;
  photoId: string | null;
};

type CargoFile = { id: string; fileName: string; sizeBytes: number };

type Row = {
  id: string;
  regNumber: string;
  status: string;
  totalBoxes: number;
  totalWeightKg: string;
  totalVolumeM3: string;
  clientCode: string;
  clientName: string;
  warehouseCode: string | null;
  warehouseGsCode: string | null;
  photoId: string | null;
  files: CargoFile[];
  lines: Line[];
};

/** Bitta tovar (qator)ning QR kodini ko'rsatadigan popover — shu tovarning
 * barcha karobkalari bir xil kodga ega bo'lgani uchun bitta rasm yetarli. */
function LineQrButton({
  lineId,
  code,
}: {
  lineId: string;
  code: string;
}) {
  const t = useTranslations("cargo");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  async function handleOpen() {
    setOpen(true);
    if (dataUrl) return;
    setLoading(true);
    const result = await getLineQrPreviewAction(lineId);
    setDataUrl(result?.dataUrl ?? null);
    setLoading(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 font-mono text-xs font-medium text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
      >
        {icons.qr("h-3.5 w-3.5")}
        {code}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-xs rounded-xl border border-line bg-surface p-5 text-center shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-mono text-sm font-bold">{code}</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-surface-2"
              >
                {icons.close("h-4 w-4")}
              </button>
            </div>

            {loading && <p className="py-10 text-sm text-muted">…</p>}
            {dataUrl && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={dataUrl} alt={code} className="mx-auto h-40 w-40" />
                <p className="mt-2 text-xs text-muted">{t("sameCodeNote")}</p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function FileList({ files }: { files: CargoFile[] }) {
  const t = useTranslations("cargo");
  if (files.length === 0) return null;
  return (
    <div className="border-t border-line px-3 py-2">
      <span className="text-[11px] font-bold tracking-wider text-muted uppercase">
        {t("receiptFiles")} ({files.length})
      </span>
      <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
        {files.map((f) => (
          <li key={f.id}>
            <a
              href={`/api/files/${f.id}`}
              target="_blank"
              onClick={(e) => e.stopPropagation()}
              className="text-xs font-medium text-primary hover:underline"
            >
              {f.fileName}
            </a>{" "}
            <span className="text-xs text-muted">
              ({Math.round(f.sizeBytes / 1024)} KB)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CargoShipmentsTable({ rows }: { rows: Row[] }) {
  const t = useTranslations("cargo");
  const ts = useTranslations("cargoStatus");
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <TableWrap>
      <thead className="bg-surface-2/60">
        <tr>
          <Th></Th>
          <Th>{t("photo")}</Th>
          <Th>{t("regNumber")}</Th>
          <Th>{t("client")}</Th>
          <Th>{t("warehouse")}</Th>
          <Th className="text-right">{t("boxCount")}</Th>
          <Th className="text-right">{t("totalWeight")}</Th>
          <Th className="text-right">{t("totalVolume")}</Th>
          <Th>{t("status")}</Th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && <EmptyRow colSpan={9} text={t("empty")} />}
        {rows.map((c) => {
          const isOpen = openId === c.id;
          return (
            <Fragment key={c.id}>
              <TRow
                className="cursor-pointer"
                onClick={() => setOpenId(isOpen ? null : c.id)}
              >
                <Td className="w-8">
                  {c.lines.length > 0 && (
                    <span
                      aria-label={t("toggleLines")}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-muted"
                    >
                      <svg
                        viewBox="0 0 16 16"
                        className={`h-4 w-4 transition-transform ${isOpen ? "rotate-90" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M6 4l4 4-4 4" />
                      </svg>
                    </span>
                  )}
                </Td>
                <Td>
                  {c.photoId ? (
                    <PhotoThumbs
                      photos={[{ id: c.photoId, name: c.regNumber }]}
                      thumbClass="h-9 w-9"
                    />
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-muted">
                      {icons.camera("h-4 w-4")}
                    </span>
                  )}
                </Td>
                <Td>
                  <Link
                    href={`/cargo/${c.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-mono font-semibold text-primary hover:underline"
                  >
                    {c.regNumber}
                  </Link>
                </Td>
                <Td>
                  <span className="font-mono font-semibold">
                    {c.clientCode}
                  </span>
                  <span className="ml-1.5 hidden text-muted sm:inline">
                    {c.clientName}
                  </span>
                </Td>
                <Td className="text-muted">{c.warehouseCode ?? "—"}</Td>
                <Td className="text-right font-mono tabular-nums">
                  {c.totalBoxes}
                </Td>
                <Td className="text-right font-mono tabular-nums">
                  {c.totalWeightKg}
                </Td>
                <Td className="text-right font-mono tabular-nums">
                  {c.totalVolumeM3}
                </Td>
                <Td>
                  <Badge className={statusColors[c.status] ?? ""}>
                    {ts(c.status)}
                  </Badge>
                </Td>
              </TRow>
              {isOpen && (
                <tr className="border-t border-line bg-surface-2/40">
                  <td colSpan={9} className="p-0">
                    <div className="overflow-x-auto p-3">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-[11px] font-semibold tracking-wider text-muted uppercase">
                            <th className="px-2 py-1.5">{t("photo")}</th>
                            <th className="px-2 py-1.5">{t("product")}</th>
                            <th className="px-2 py-1.5 text-right">
                              {t("boxCount")}
                            </th>
                            <th className="px-2 py-1.5">{t("boxDims")}</th>
                            <th className="px-2 py-1.5 text-right">
                              {t("weightPerBox")}
                            </th>
                            <th className="px-2 py-1.5 text-right">
                              {t("totalWeight")}
                            </th>
                            <th className="px-2 py-1.5 text-right">
                              {t("totalVolume")}
                            </th>
                            <th className="px-2 py-1.5">{t("qrCode")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {c.lines.map((l) => {
                            const code = `${c.warehouseGsCode ?? "?"}-${c.clientCode}-${l.letterCode}`;
                            return (
                              <tr key={l.id} className="border-t border-line/60">
                                <td className="px-2 py-1.5">
                                  {l.photoId ? (
                                    <PhotoThumbs
                                      photos={[
                                        { id: l.photoId, name: l.productName },
                                      ]}
                                      thumbClass="h-10 w-10"
                                    />
                                  ) : (
                                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-2 text-muted">
                                      {icons.camera("h-4 w-4")}
                                    </span>
                                  )}
                                </td>
                                <td className="px-2 py-1.5 font-medium">
                                  {l.productName}
                                </td>
                                <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                                  {l.boxCount}
                                </td>
                                <td className="px-2 py-1.5 font-mono text-muted tabular-nums">
                                  {l.boxLengthCm
                                    ? `${+l.boxLengthCm}×${+l.boxWidthCm!}×${+l.boxHeightCm!}`
                                    : "—"}
                                </td>
                                <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                                  {l.weightPerBoxKg ?? "—"}
                                </td>
                                <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                                  {l.totalWeightKg}
                                </td>
                                <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                                  {l.totalVolumeM3}
                                </td>
                                <td className="px-2 py-1.5">
                                  <LineQrButton lineId={l.id} code={code} />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <FileList files={c.files} />
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </TableWrap>
  );
}
