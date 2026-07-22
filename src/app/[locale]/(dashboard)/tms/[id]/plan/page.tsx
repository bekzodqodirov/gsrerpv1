import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/routing";
import { getBatch, getAvailableLines } from "@/modules/tms/service";
import { Card, TableWrap, Th, Td, TRow, EmptyRow } from "@/components/ui";
import { PhotoThumbs } from "@/components/photo-lightbox";
import { icons } from "@/components/icons";
import { FillBar } from "../fill-bar";
import { PlanBuilder } from "../plan-builder";
import { PlanLineControls } from "../plan-line-controls";

// Plan tuzish sahifasi — menejer/yuk beruvchi uchun: joriy plan (miqdorlarni
// o'zgartirish/olib tashlash bilan) + ombordagi tovarlardan qo'shish.
// Skaner va manifest bu yerda YO'Q — har ish o'z sahifasida.
export default async function BatchPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const data = await getBatch(id);
  if (!data) notFound();

  const t = await getTranslations("tms");
  const { batch, origin, dest, carrier, lines, totals, canLoad } = data;
  const editable = batch.status === "planned" || batch.status === "loading";
  if (!editable || !canLoad) {
    redirect({ href: `/tms/${id}`, locale });
  }

  const num = (n: number, d = 0) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: d }).format(n);

  const capKg = carrier?.capacityKg ? Number(carrier.capacityKg) : null;
  const capM3 = carrier?.capacityM3 ? Number(carrier.capacityM3) : null;
  const available = await getAvailableLines(id);

  return (
    <div className="space-y-4">
      <div>
        <Link
          href={`/tms/${id}`}
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
        >
          ← <span className="font-mono font-semibold">{batch.code}</span>
        </Link>
        <h1 className="mt-1 text-xl font-bold tracking-tight">
          {t("planTitle")}
        </h1>
        <p className="mt-0.5 text-sm text-muted">
          {origin?.name} → {dest?.name}
        </p>
      </div>

      {/* Sig'im */}
      {carrier && (capKg || capM3) && (
        <Card className="p-4">
          <div className="mb-2 text-sm font-semibold text-muted">{t("capacity")}</div>
          <div className="space-y-3">
            {capKg && (
              <FillBar label={t("weight")} value={totals.totalWeightKg} max={capKg} unit="kg" num={num} />
            )}
            {capM3 && (
              <FillBar label={t("volume")} value={totals.totalVolumeM3} max={capM3} unit="m³" num={num} />
            )}
          </div>
        </Card>
      )}

      {/* Joriy plan — miqdor o'zgartirish / olib tashlash */}
      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted">
          {t("currentPlan")} · {num(totals.totalBoxes)} {t("boxesShort")}
        </h2>
        <TableWrap>
          <thead>
            <tr>
              <Th>{t("photo")}</Th>
              <Th>{t("zone")}</Th>
              <Th>{t("product")}</Th>
              <Th className="text-right">{t("planCol")}</Th>
              <Th className="text-right">{t("loadedCol")}</Th>
              <Th className="text-right">{t("weight")}</Th>
              <Th className="text-right">{t("volume")}</Th>
              <Th className="w-24" />
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <EmptyRow colSpan={8} text={t("noCargo")} />
            ) : (
              lines.map((l) => (
                <TRow key={l.lineId}>
                  <Td>
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
                  </Td>
                  <Td>
                    {l.zone ? (
                      <span className="rounded-md bg-primary-soft px-2 py-0.5 font-mono text-xs font-bold text-primary">
                        {l.zone}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </Td>
                  <Td>
                    <div className="font-mono text-sm font-black">
                      {l.clientCode}-{l.letterCode}
                    </div>
                    <div className="max-w-52 truncate text-sm">{l.productName}</div>
                    <div className="font-mono text-[11px] text-muted">{l.regNumber}</div>
                  </Td>
                  <Td className="text-right font-mono tabular-nums">{num(l.planned)}</Td>
                  <Td className="text-right font-mono tabular-nums">{num(l.loaded)}</Td>
                  <Td className="text-right font-mono text-xs tabular-nums">
                    {num(l.plannedKg, 1)}
                  </Td>
                  <Td className="text-right font-mono text-xs tabular-nums">
                    {num(l.plannedM3, 2)}
                  </Td>
                  <Td>
                    <PlanLineControls
                      batchId={id}
                      lineId={l.lineId}
                      planned={l.planned}
                      loaded={l.loaded}
                    />
                  </Td>
                </TRow>
              ))
            )}
          </tbody>
        </TableWrap>
      </div>

      {/* Ombordagi tovarlardan planga qo'shish */}
      <PlanBuilder
        batchId={id}
        lines={available}
        planKg={totals.totalWeightKg}
        planM3={totals.totalVolumeM3}
        capKg={capKg}
        capM3={capM3}
      />
    </div>
  );
}
