"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Badge } from "@/components/ui";
import { icons } from "@/components/icons";
import { batchStatusColors } from "@/components/batch-status";
import {
  DataTable,
  type Column,
  type DataTableLabels,
} from "@/components/data-table";

// Raqamlar SERVER tomonda formatlanadi (locale) va matn sifatida keladi —
// client'da Intl ishlatilmaydi (SSR/hydration mos kelmasligini oldini oladi).
type Row = {
  id: string;
  code: string;
  status: string;
  originGs: string;
  destGs: string;
  cargoCount: number;
  volumeText: string;
  weightText: string;
  cargosText: string;
  priceText: string;
};

const scannable = (b: Row) =>
  b.status === "departed" || b.status === "arrived"
    ? true
    : (b.status === "planned" || b.status === "loading") && b.cargoCount > 0;

export function BatchesTable({
  rows,
  canManage,
  canLoad,
}: {
  rows: Row[];
  canManage: boolean;
  canLoad: boolean;
}) {
  const t = useTranslations("tms");
  const ts = useTranslations("batchStatus");
  const tt = useTranslations("table");

  const labels: DataTableLabels = {
    search: tt("search"),
    columns: tt("columns"),
    filters: tt("filters"),
    reset: tt("reset"),
    noMatch: tt("noMatch"),
    all: tt("all"),
    empty: t("noBatches"),
    resize: tt("resize"),
    resetWidths: tt("resetWidths"),
  };

  const columns: Column<Row>[] = [
    {
      id: "code",
      header: t("code"),
      value: (b) => b.code,
      filter: "text",
      cell: (b) => (
        <Link
          href={`/tms/${b.id}`}
          onClick={(e) => e.stopPropagation()}
          className="font-mono text-sm font-semibold text-primary hover:underline"
        >
          {b.code}
        </Link>
      ),
    },
    {
      id: "route",
      header: t("route"),
      value: (b) => `${b.originGs} ${b.destGs}`,
      filter: "text",
      cell: (b) => (
        <span className="whitespace-nowrap font-mono text-xs">
          {b.originGs} <span className="text-muted">→</span> {b.destGs}
        </span>
      ),
    },
    {
      id: "status",
      header: t("status"),
      value: (b) => ts(b.status as "planned"),
      filter: "select",
      cell: (b) => (
        <Badge className={batchStatusColors[b.status] ?? ""}>
          {ts(b.status as "planned")}
        </Badge>
      ),
    },
    {
      id: "volume",
      header: t("volume"),
      align: "right",
      className: "font-mono tabular-nums",
      cell: (b) => b.volumeText,
    },
    {
      id: "weight",
      header: t("weight"),
      align: "right",
      className: "font-mono tabular-nums",
      cell: (b) => b.weightText,
    },
    {
      id: "cargos",
      header: t("cargos"),
      align: "right",
      className: "font-mono tabular-nums",
      cell: (b) => b.cargosText,
    },
    ...(canManage
      ? [
          {
            id: "price",
            header: t("price"),
            align: "right" as const,
            className: "font-mono tabular-nums",
            cell: (b: Row) => b.priceText,
          },
        ]
      : []),
    ...(canLoad
      ? [
          {
            id: "scan",
            header: "",
            cell: (b: Row) =>
              scannable(b) ? (
                <Link
                  href={`/tms/${b.id}/scan`}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex h-8 touch-manipulation items-center gap-1.5 rounded-lg bg-primary px-2.5 text-xs font-semibold text-white hover:bg-primary-hover"
                >
                  {icons.qr("h-3.5 w-3.5")}
                  {t("scanBtn")}
                </Link>
              ) : null,
          },
        ]
      : []),
  ];

  return (
    <DataTable
      tableId="tms-batches"
      columns={columns}
      rows={rows}
      getRowKey={(r) => r.id}
      labels={labels}
      rowHref={(r) => `/tms/${r.id}`}
    />
  );
}
