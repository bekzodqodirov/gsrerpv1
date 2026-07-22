import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { getBatchScanInfo } from "@/modules/tms/service";
import { AutoRefresh } from "../auto-refresh";
import { ScanScreen } from "./scan-screen";

// Skaner sahifasi — yengil: faqat partiya + progress so'raladi,
// manifest/plan/rasmlar yo'q (telefonda tez ochilishi uchun).
export default async function BatchScanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const info = await getBatchScanInfo(id);
  if (!info) notFound();

  const { batch, origin, dest, loadProgress, unloadProgress, canLoad } = info;
  const editable = batch.status === "planned" || batch.status === "loading";
  const unloadable = batch.status === "departed" || batch.status === "arrived";

  // Scan qilib bo'lmaydigan holat — obzorga qaytaramiz.
  if (!canLoad || (!editable && !unloadable)) {
    redirect({ href: `/tms/${id}`, locale });
  }
  // Sklad tomoni mos emas: yuklashni faqat jo'natuvchi, tushirishni faqat
  // qabul qiluvchi ombor xodimi qiladi — aks holda obzorga.
  if ((editable && !info.canScanLoad) || (unloadable && !info.canScanUnload)) {
    redirect({ href: `/tms/${id}`, locale });
  }
  // Plan hali tuzilmagan bo'lsa scan qilishga narsa yo'q.
  if (editable && loadProgress.total === 0) {
    redirect({ href: `/tms/${id}`, locale });
  }

  const mode = editable ? "load" : "unload";
  const prog = mode === "load" ? loadProgress : unloadProgress;

  return (
    <>
      {/* Boshqa ishchilarning scanlari ham progressda ko'rinib tursin */}
      <AutoRefresh seconds={12} />
      <ScanScreen
        batchId={id}
        mode={mode}
        done={prog.done}
        total={prog.total}
        batchCode={batch.code}
        routeLabel={`${origin?.gsCode ?? ""} → ${dest?.gsCode ?? ""}`}
      />
    </>
  );
}
