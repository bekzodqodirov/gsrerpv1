import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCargo, getCargoBoxes } from "@/modules/cargo/service";
import { getSession } from "@/modules/shared/auth";
import { listAttachments } from "@/modules/shared/attachments";
import { statusColors } from "@/components/cargo-status";
import { Link } from "@/i18n/routing";
import {
  Badge,
  Card,
  StatCard,
  TableWrap,
  Th,
  Td,
  TRow,
} from "@/components/ui";
import { icons } from "@/components/icons";

export default async function CargoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("cargo");
  const ts = await getTranslations("cargoStatus");

  const data = await getCargo(id);
  if (!data) notFound();
  const { cargo, clientCode, clientName, warehouseCode, lines } = data;

  const session = await getSession();
  const canEdit =
    (session?.perms.includes("*") || session?.perms.includes("cargo.receive")) &&
    cargo.status === "received_cn";

  const [cargoFiles, boxes, ...lineFiles] = await Promise.all([
    listAttachments("cargo", cargo.id),
    getCargoBoxes(cargo.id),
    ...lines.map((l) => listAttachments("cargo_line", l.id)),
  ]);

  const qrRangeByLine = new Map<string, { first: string; lastLetter: string }>();
  for (const b of boxes) {
    const existing = qrRangeByLine.get(b.lineId);
    if (!existing) {
      qrRangeByLine.set(b.lineId, { first: b.qrCode, lastLetter: b.letterCode });
    } else {
      existing.lastLetter = b.letterCode;
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-xl font-bold sm:text-2xl">
              {cargo.regNumber}
            </h1>
            <Badge className={statusColors[cargo.status] ?? ""}>
              {ts(cargo.status)}
            </Badge>
          </div>
          <p className="mt-1.5 text-sm text-muted">
            <span className="font-mono font-semibold text-foreground">
              {clientCode}
            </span>{" "}
            {clientName} · {warehouseCode ?? "—"} ·{" "}
            {cargo.receivedAt.toISOString().slice(0, 10)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Link
              href={`/cargo/${cargo.id}/edit`}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-line px-4 text-sm font-medium transition-colors hover:bg-surface-2"
            >
              {icons.edit("h-4.5 w-4.5")}
              {t("editCargo")}
            </Link>
          )}
          <Link
            href={`/cargo/${cargo.id}/labels`}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-hover"
          >
            {icons.qr("h-4.5 w-4.5")}
            {t("qrLabels")}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:max-w-md">
        <StatCard value={cargo.totalBoxes} label={t("boxCount")} />
        <StatCard value={cargo.totalWeightKg} label={t("totalWeight")} />
        <StatCard value={cargo.totalVolumeM3} label={t("totalVolume")} />
      </div>

      <TableWrap>
        <thead className="bg-surface-2/60">
          <tr>
            <Th>#</Th>
            <Th>{t("product")}</Th>
            <Th className="text-right">{t("boxCount")}</Th>
            <Th>{t("boxDims")}</Th>
            <Th className="text-right">{t("weightPerBox")}</Th>
            <Th className="text-right">{t("totalWeight")}</Th>
            <Th className="text-right">{t("totalVolume")}</Th>
            <Th>{t("qrCode")}</Th>
            <Th>{t("linePhotos")}</Th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => {
            const qr = qrRangeByLine.get(l.id);
            return (
            <TRow key={l.id}>
              <Td className="text-muted">{l.lineNo}</Td>
              <Td className="font-medium">{l.productName}</Td>
              <Td className="text-right font-mono tabular-nums">{l.boxCount}</Td>
              <Td className="font-mono text-muted tabular-nums">
                {l.boxLengthCm
                  ? `${+l.boxLengthCm}×${+l.boxWidthCm!}×${+l.boxHeightCm!}`
                  : "—"}
              </Td>
              <Td className="text-right font-mono tabular-nums">
                {l.weightPerBoxKg ?? "—"}
              </Td>
              <Td className="text-right font-mono tabular-nums">
                {l.totalWeightKg}
              </Td>
              <Td className="text-right font-mono tabular-nums">
                {l.totalVolumeM3}
              </Td>
              <Td className="font-mono text-xs whitespace-nowrap text-muted">
                {qr
                  ? l.boxCount > 1
                    ? `${qr.first} … ${qr.lastLetter}`
                    : qr.first
                  : "—"}
              </Td>
              <Td>
                <div className="flex flex-wrap gap-1.5">
                  {lineFiles[i]?.map((f) => (
                    <a
                      key={f.id}
                      href={`/api/files/${f.id}`}
                      target="_blank"
                      className="block h-11 w-11 overflow-hidden rounded-lg border border-line transition-transform hover:scale-105"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/files/${f.id}`}
                        alt={f.fileName}
                        className="h-full w-full object-cover"
                      />
                    </a>
                  ))}
                  {(!lineFiles[i] || lineFiles[i].length === 0) && (
                    <span className="text-muted">—</span>
                  )}
                </div>
              </Td>
            </TRow>
            );
          })}
        </tbody>
      </TableWrap>

      <Card className="p-4 sm:p-5">
        <h2 className="text-[11px] font-bold tracking-wider text-muted uppercase">
          {t("receiptFiles")}
        </h2>
        {cargoFiles.length === 0 ? (
          <p className="mt-2 text-sm text-muted">—</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {cargoFiles.map((f) => (
              <li key={f.id} className="flex items-center gap-2">
                <a
                  href={`/api/files/${f.id}`}
                  target="_blank"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {f.fileName}
                </a>
                <span className="text-xs text-muted">
                  {Math.round(f.sizeBytes / 1024)} KB
                </span>
              </li>
            ))}
          </ul>
        )}
        {cargo.note && (
          <p className="mt-3 border-t border-line pt-3 text-sm text-muted">
            {cargo.note}
          </p>
        )}
      </Card>
    </div>
  );
}
