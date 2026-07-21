import { getTranslations } from "next-intl/server";
import { getSession } from "@/modules/shared/auth";
import { listCargos, getReceiveFormData } from "@/modules/cargo/service";
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
  Badge,
  Input,
  Select,
  Button,
} from "@/components/ui";
import { icons } from "@/components/icons";
import { statusColors } from "@/components/cargo-status";
import { CargoForm } from "./cargo-form";

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

  const [rows, formData] = await Promise.all([
    listCargos({ q, status: validStatus }),
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

      <TableWrap>
        <thead className="bg-surface-2/60">
          <tr>
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
          {rows.length === 0 && <EmptyRow colSpan={7} text={t("empty")} />}
          {rows.map((c) => (
            <TRow key={c.id}>
              <Td>
                <Link
                  href={`/cargo/${c.id}`}
                  className="font-mono font-semibold text-primary hover:underline"
                >
                  {c.regNumber}
                </Link>
              </Td>
              <Td>
                <span className="font-mono font-semibold">{c.clientCode}</span>
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
          ))}
        </tbody>
      </TableWrap>
    </div>
  );
}
