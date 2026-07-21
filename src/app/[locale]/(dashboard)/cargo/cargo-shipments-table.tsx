"use client";

import { Fragment, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { TableWrap, Th, Td, TRow, EmptyRow, Badge } from "@/components/ui";
import { icons } from "@/components/icons";
import { statusColors } from "@/components/cargo-status";

type Line = {
  id: string;
  lineNo: number;
  productName: string;
  boxCount: number;
  totalWeightKg: string;
  totalVolumeM3: string;
};

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
  photoId: string | null;
  lines: Line[];
};

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
              <TRow>
                <Td className="w-8">
                  {c.lines.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setOpenId(isOpen ? null : c.id)}
                      aria-label={t("toggleLines")}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
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
                    </button>
                  )}
                </Td>
                <Td>
                  {c.photoId ? (
                    <a
                      href={`/api/files/${c.photoId}`}
                      target="_blank"
                      className="block h-9 w-9 overflow-hidden rounded-lg border border-line transition-transform hover:scale-105"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/files/${c.photoId}`}
                        alt={c.regNumber}
                        className="h-full w-full object-cover"
                      />
                    </a>
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-muted">
                      {icons.camera("h-4 w-4")}
                    </span>
                  )}
                </Td>
                <Td>
                  <Link
                    href={`/cargo/${c.id}`}
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
                  <td colSpan={9} className="px-4 py-3">
                    <div className="space-y-1">
                      {c.lines.map((l) => (
                        <div
                          key={l.id}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="font-medium">
                            {l.lineNo}. {l.productName}
                          </span>
                          <span className="font-mono text-xs text-muted tabular-nums">
                            {l.boxCount} · {l.totalWeightKg} kg ·{" "}
                            {l.totalVolumeM3} m³
                          </span>
                        </div>
                      ))}
                    </div>
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
