"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Badge } from "@/components/ui";
import { DataTable, type Column, type DataTableLabels } from "@/components/data-table";
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
function LineQrButton({ lineId, code }: { lineId: string; code: string }) {
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
        onClick={(e) => {
          e.stopPropagation();
          handleOpen();
        }}
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

/** Kengaytirilgan qator: tovar (qator) tafsilotlari + fayllar. */
function LineDetails({ row }: { row: Row }) {
  const t = useTranslations("cargo");
  return (
    <div>
      <div className="overflow-x-auto p-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] font-semibold tracking-wider text-muted uppercase">
              <th className="px-2 py-1.5">{t("photo")}</th>
              <th className="px-2 py-1.5">{t("product")}</th>
              <th className="px-2 py-1.5 text-right">{t("boxCount")}</th>
              <th className="px-2 py-1.5">{t("boxDims")}</th>
              <th className="px-2 py-1.5 text-right">{t("weightPerBox")}</th>
              <th className="px-2 py-1.5 text-right">{t("totalWeight")}</th>
              <th className="px-2 py-1.5 text-right">{t("totalVolume")}</th>
              <th className="px-2 py-1.5">{t("qrCode")}</th>
            </tr>
          </thead>
          <tbody>
            {row.lines.map((l) => {
              const code = `${row.warehouseGsCode ?? "?"}-${row.clientCode}-${l.letterCode}`;
              return (
                <tr key={l.id} className="border-t border-line/60">
                  <td className="px-2 py-1.5">
                    {l.photoId ? (
                      <PhotoThumbs
                        photos={[{ id: l.photoId, name: l.productName }]}
                        thumbClass="h-10 w-10"
                      />
                    ) : (
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-2 text-muted">
                        {icons.camera("h-4 w-4")}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 font-medium">{l.productName}</td>
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
      <FileList files={row.files} />
    </div>
  );
}

export function CargoShipmentsTable({ rows }: { rows: Row[] }) {
  const t = useTranslations("cargo");
  const ts = useTranslations("cargoStatus");
  const tt = useTranslations("table");

  const labels: DataTableLabels = {
    search: tt("search"),
    columns: tt("columns"),
    filters: tt("filters"),
    reset: tt("reset"),
    noMatch: tt("noMatch"),
    all: tt("all"),
    empty: t("empty"),
  };

  const columns: Column<Row>[] = [
    {
      id: "photo",
      header: t("photo"),
      cell: (c) =>
        c.photoId ? (
          <PhotoThumbs
            photos={[{ id: c.photoId, name: c.regNumber }]}
            thumbClass="h-9 w-9"
          />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-muted">
            {icons.camera("h-4 w-4")}
          </span>
        ),
    },
    {
      id: "reg",
      header: t("regNumber"),
      value: (c) => c.regNumber,
      filter: "text",
      cell: (c) => (
        <Link
          href={`/cargo/${c.id}`}
          onClick={(e) => e.stopPropagation()}
          className="font-mono font-semibold text-primary hover:underline"
        >
          {c.regNumber}
        </Link>
      ),
    },
    {
      id: "client",
      header: t("client"),
      value: (c) => `${c.clientCode} ${c.clientName}`,
      filter: "text",
      cell: (c) => (
        <span>
          <span className="font-mono font-semibold">{c.clientCode}</span>
          <span className="ml-1.5 text-muted">{c.clientName}</span>
        </span>
      ),
    },
    {
      id: "warehouse",
      header: t("warehouse"),
      value: (c) => c.warehouseCode ?? "",
      filter: "select",
      cell: (c) => <span className="text-muted">{c.warehouseCode ?? "—"}</span>,
    },
    {
      id: "boxes",
      header: t("boxCount"),
      align: "right",
      className: "font-mono tabular-nums",
      cell: (c) => c.totalBoxes,
    },
    {
      id: "weight",
      header: t("totalWeight"),
      align: "right",
      className: "font-mono tabular-nums",
      cell: (c) => c.totalWeightKg,
    },
    {
      id: "volume",
      header: t("totalVolume"),
      align: "right",
      className: "font-mono tabular-nums",
      cell: (c) => c.totalVolumeM3,
    },
    {
      id: "status",
      header: t("status"),
      value: (c) => ts(c.status as "received_cn"),
      filter: "select",
      cell: (c) => (
        <Badge className={statusColors[c.status] ?? ""}>
          {ts(c.status as "received_cn")}
        </Badge>
      ),
    },
  ];

  return (
    <DataTable
      tableId="cargo-shipments"
      columns={columns}
      rows={rows}
      getRowKey={(r) => r.id}
      labels={labels}
      rowHref={(r) => `/cargo/${r.id}`}
      renderExpanded={(row) => <LineDetails row={row} />}
    />
  );
}
