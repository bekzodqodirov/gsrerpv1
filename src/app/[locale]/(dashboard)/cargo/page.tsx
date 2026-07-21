import { Fragment } from "react";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/modules/shared/auth";
import {
  listCargos,
  listCargoLines,
  getReceiveFormData,
} from "@/modules/cargo/service";
import { cargoStatuses, type CargoStatus } from "@/modules/cargo/dto";
import { Link } from "@/i18n/routing";
import {
  PageHeader,
  CollapsibleCard,
  TableWrap,
  Th,
  Td,
  TRow,
  EmptyRow,
  Input,
  Select,
  Button,
} from "@/components/ui";
import { icons } from "@/components/icons";
import { CargoForm } from "./cargo-form";
import { CargoShipmentsTable } from "./cargo-shipments-table";

export default async function CargoPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status } = await searchParams;
  const t = await getTranslations("cargo");
  const ts = await getTranslations("cargoStatus");
  const tc = await getTranslations("common");
  const session = await getSession();

  const validStatus = cargoStatuses.includes(status as CargoStatus)
    ? (status as CargoStatus)
    : undefined;

  const [rows, lineRows, formData] = await Promise.all([
    listCargos({ q, status: validStatus }),
    listCargoLines({ q, status: validStatus }),
    getReceiveFormData(),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")}>
        <form className="flex flex-wrap gap-2">
          <Select
            name="status"
            defaultValue={validStatus ?? ""}
            className="w-auto min-w-36"
          >
            <option value="">{t("allStatuses")}</option>
            {cargoStatuses.map((s) => (
              <option key={s} value={s}>
                {ts(s)}
              </option>
            ))}
          </Select>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted">
              {icons.search("h-4 w-4")}
            </span>
            <Input
              name="q"
              defaultValue={q ?? ""}
              placeholder={tc("search")}
              className="w-40 pl-9 sm:w-56"
            />
          </div>
          <Button type="submit" variant="outline">
            {tc("search")}
          </Button>
        </form>
      </PageHeader>

      <CollapsibleCard title={t("newCargo")}>
        <CargoForm
          clients={formData.clients}
          warehouses={formData.warehouses}
          fixedWarehouseId={session?.warehouseId ?? null}
        />
      </CollapsibleCard>

      {/* Prixodlar (yuklar) — umumiy rasm, kengaytiriladigan tovar ro'yxati */}
      <CargoShipmentsTable rows={rows} />

      {/* Tovarlar — qatorlar, bir prixodga tegishlilari guruhlab ko'rsatiladi */}
      <div>
        <h2 className="mb-2 text-[11px] font-bold tracking-wider text-muted uppercase">
          {t("productsSection")}
        </h2>
        <TableWrap>
          <thead className="bg-surface-2/60">
            <tr>
              <Th>{t("photo")}</Th>
              <Th>{t("product")}</Th>
              <Th className="text-right">{t("boxCount")}</Th>
              <Th className="text-right">{t("totalWeight")}</Th>
              <Th className="text-right">{t("totalVolume")}</Th>
              <Th>{t("qrCode")}</Th>
            </tr>
          </thead>
          <tbody>
            {lineRows.length === 0 && <EmptyRow colSpan={6} text={t("empty")} />}
            {(() => {
              let lastReg: string | null = null;
              return lineRows.map((r) => {
                const isNewGroup = r.regNumber !== lastReg;
                lastReg = r.regNumber;
                const lastLetter = r.qrLast?.split("-").pop();
                return (
                  <Fragment key={r.lineId}>
                    {isNewGroup && (
                      <tr className="border-t border-line bg-surface-2/60">
                        <td colSpan={6} className="px-4 py-1.5">
                          <Link
                            href={`/cargo/${r.cargoId}`}
                            className="font-mono text-xs font-bold text-primary hover:underline"
                          >
                            {r.regNumber}
                          </Link>
                          <span className="ml-2 font-mono text-xs font-semibold text-muted">
                            {r.clientCode}
                          </span>
                          <span className="ml-1.5 hidden text-xs text-muted sm:inline">
                            {r.clientName}
                          </span>
                          <span className="ml-2 text-xs text-muted">
                            {r.receivedAt.toISOString().slice(0, 10)}
                          </span>
                        </td>
                      </tr>
                    )}
                    <TRow>
                      <Td>
                        {r.photoId ? (
                          <a
                            href={`/api/files/${r.photoId}`}
                            target="_blank"
                            className="block h-10 w-10 overflow-hidden rounded-lg border border-line transition-transform hover:scale-105"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`/api/files/${r.photoId}`}
                              alt={r.productName}
                              className="h-full w-full object-cover"
                            />
                          </a>
                        ) : (
                          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-2 text-muted">
                            {icons.camera("h-4 w-4")}
                          </span>
                        )}
                      </Td>
                      <Td className="font-medium">{r.productName}</Td>
                      <Td className="text-right font-mono tabular-nums">
                        {r.boxCount}
                      </Td>
                      <Td className="text-right font-mono tabular-nums">
                        {r.totalWeightKg}
                      </Td>
                      <Td className="text-right font-mono tabular-nums">
                        {r.totalVolumeM3}
                      </Td>
                      <Td className="font-mono text-xs whitespace-nowrap text-muted">
                        {r.qrFirst
                          ? r.boxCount > 1
                            ? `${r.qrFirst} … ${lastLetter}`
                            : r.qrFirst
                          : "—"}
                      </Td>
                    </TRow>
                  </Fragment>
                );
              });
            })()}
          </tbody>
        </TableWrap>
      </div>
    </div>
  );
}
