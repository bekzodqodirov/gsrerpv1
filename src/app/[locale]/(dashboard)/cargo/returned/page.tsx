import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { listCargos } from "@/modules/cargo/service";
import {
  PageHeader,
  TableWrap,
  Th,
  Td,
  TRow,
  EmptyRow,
} from "@/components/ui";

// Qaytarilgan yuklar ALOHIDA ro'yxati (umumiy ro'yxatda ko'rinmaydi).
export default async function ReturnedCargoPage() {
  const t = await getTranslations("cargo");
  const rows = await listCargos({ status: "returned" });

  return (
    <div className="space-y-4">
      <PageHeader title={t("returnedList")}>
        <Link href="/cargo" className="text-sm text-muted hover:text-foreground">
          ← {t("title")}
        </Link>
      </PageHeader>

      <TableWrap>
        <thead className="bg-surface-2/60">
          <tr>
            <Th>{t("regNumber")}</Th>
            <Th>{t("client")}</Th>
            <Th>{t("warehouse")}</Th>
            <Th className="text-right">{t("boxCount")}</Th>
            <Th className="text-right">{t("totalWeight")}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={5} text={t("empty")} />
          ) : (
            rows.map((c) => (
              <TRow key={c.id}>
                <Td className="font-mono text-sm font-semibold">
                  <Link
                    href={`/cargo/${c.id}`}
                    className="text-primary hover:underline"
                  >
                    {c.regNumber}
                  </Link>
                </Td>
                <Td>
                  <span className="font-mono font-semibold">{c.clientCode}</span>
                </Td>
                <Td className="text-muted">{c.warehouseCode ?? "—"}</Td>
                <Td className="text-right font-mono tabular-nums">
                  {c.totalBoxes}
                </Td>
                <Td className="text-right font-mono tabular-nums">
                  {c.totalWeightKg}
                </Td>
              </TRow>
            ))
          )}
        </tbody>
      </TableWrap>
    </div>
  );
}
