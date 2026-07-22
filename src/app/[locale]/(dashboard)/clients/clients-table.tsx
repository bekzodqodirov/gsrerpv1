"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui";
import {
  DataTable,
  type Column,
  type DataTableLabels,
} from "@/components/data-table";

type Row = {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  city: string | null;
  creditLimitUsd: string | null;
  isActive: boolean;
};

export function ClientsTable({ rows }: { rows: Row[] }) {
  const t = useTranslations("clients");
  const tt = useTranslations("table");

  const labels: DataTableLabels = {
    search: tt("search"),
    columns: tt("columns"),
    filters: tt("filters"),
    reset: tt("reset"),
    noMatch: tt("noMatch"),
    all: tt("all"),
    empty: t("empty"),
    resize: tt("resize"),
    resetWidths: tt("resetWidths"),
  };

  const columns: Column<Row>[] = [
    {
      id: "code",
      header: t("code"),
      value: (c) => c.code,
      filter: "text",
      cell: (c) => <span className="font-mono font-semibold">{c.code}</span>,
    },
    {
      id: "name",
      header: t("name"),
      value: (c) => c.name,
      filter: "text",
      cell: (c) => <span className="font-medium">{c.name}</span>,
    },
    {
      id: "phone",
      header: t("phone"),
      value: (c) => c.phone ?? "",
      filter: "text",
      cell: (c) => <span className="text-muted">{c.phone ?? "—"}</span>,
    },
    {
      id: "city",
      header: t("city"),
      value: (c) => c.city ?? "",
      filter: "select",
      cell: (c) => <span className="text-muted">{c.city ?? "—"}</span>,
    },
    {
      id: "creditLimit",
      header: t("creditLimit"),
      align: "right",
      className: "font-mono tabular-nums",
      cell: (c) => (c.creditLimitUsd != null ? `$${c.creditLimitUsd}` : "—"),
    },
    {
      id: "status",
      header: t("status"),
      value: (c) => (c.isActive ? t("active") : t("inactive")),
      filter: "select",
      cell: (c) => (
        <Badge
          className={
            c.isActive
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
              : "bg-surface-2 text-muted"
          }
        >
          {c.isActive ? t("active") : t("inactive")}
        </Badge>
      ),
    },
  ];

  return (
    <DataTable
      tableId="clients"
      columns={columns}
      rows={rows}
      getRowKey={(r) => r.id}
      labels={labels}
    />
  );
}
