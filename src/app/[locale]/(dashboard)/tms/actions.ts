"use server";

import { revalidatePath } from "next/cache";
import {
  createBatch,
  updateBatch,
  createCarrier,
  setCarrierActive,
  setPlanLine,
  addPlanLines,
  removePlanLine,
  startLoading,
  departBatch,
  arriveBatch,
  unloadBatch,
  closeBatch,
  scanLoad,
  scanUnload,
  addLineAndScanLoad,
} from "@/modules/tms/service";
import {
  batchCreateSchema,
  batchUpdateSchema,
  carrierSchema,
  scanSchema,
  planLinesSchema,
  type ScanResult,
} from "@/modules/tms/dto";

function revalidateTms() {
  revalidatePath("/[locale]/tms", "layout");
  revalidatePath("/[locale]/stock", "page");
}

export type BatchFormState = { error?: string; createdId?: string };

export async function createBatchAction(
  _prev: BatchFormState,
  formData: FormData,
): Promise<BatchFormState> {
  const str = (k: string) => String(formData.get(k) ?? "");
  const parsed = batchCreateSchema.safeParse({
    originWarehouseId: str("originWarehouseId"),
    destinationWarehouseId: str("destinationWarehouseId"),
    carrierId: str("carrierId"),
    code: str("code"),
    agreedPrice: str("agreedPrice") || undefined,
    currency: str("currency"),
    sealNumber: str("sealNumber"),
    note: str("note"),
  });
  if (!parsed.success) return { error: "validation" };
  try {
    const b = await createBatch(parsed.data);
    revalidateTms();
    return { createdId: b.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "SAME_WAREHOUSE") return { error: "sameWarehouse" };
    if (msg === "CODE_TAKEN") return { error: "codeTaken" };
    console.error("[tms] createBatch:", e);
    return { error: "server" };
  }
}

export async function updateBatchAction(
  batchId: string,
  _prev: BatchFormState,
  formData: FormData,
): Promise<BatchFormState> {
  const str = (k: string) => String(formData.get(k) ?? "");
  const parsed = batchUpdateSchema.safeParse({
    destinationWarehouseId: str("destinationWarehouseId"),
    carrierId: str("carrierId"),
    agreedPrice: str("agreedPrice") || undefined,
    currency: str("currency"),
    sealNumber: str("sealNumber"),
    note: str("note"),
  });
  if (!parsed.success) return { error: "validation" };
  try {
    await updateBatch(batchId, parsed.data);
    revalidateTms();
    revalidatePath(`/[locale]/tms/${batchId}`, "page");
    return { createdId: batchId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "SAME_WAREHOUSE") return { error: "sameWarehouse" };
    if (msg === "NOT_EDITABLE") return { error: "notEditable" };
    console.error("[tms] updateBatch:", e);
    return { error: "server" };
  }
}

export type CarrierFormState = { error?: string; created?: boolean };

export async function createCarrierAction(
  _prev: CarrierFormState,
  formData: FormData,
): Promise<CarrierFormState> {
  const str = (k: string) => String(formData.get(k) ?? "");
  const parsed = carrierSchema.safeParse({
    name: str("name"),
    phone: str("phone"),
    truckPlate: str("truckPlate"),
    truckType: str("truckType"),
    capacityKg: str("capacityKg") || undefined,
    capacityM3: str("capacityM3") || undefined,
    note: str("note"),
  });
  if (!parsed.success) return { error: "validation" };
  try {
    await createCarrier(parsed.data);
    revalidatePath("/[locale]/tms/carriers", "page");
    return { created: true };
  } catch (e) {
    console.error("[tms] createCarrier:", e);
    return { error: "server" };
  }
}

export async function toggleCarrierActiveAction(id: string, isActive: boolean) {
  await setCarrierActive(id, isActive);
  revalidatePath("/[locale]/tms/carriers", "page");
}

// ─── Yuklash rejasi va holat o'tishlari (id'lar bilan bind qilinadi) ─────────

export type PlanActionResult = { ok?: boolean; error?: string };

/** Plan tuzuvchidan: tanlangan tovarlarni belgilangan sonlar bilan qo'shish. */
export async function addPlanLinesAction(
  batchId: string,
  items: { lineId: string; boxes: number }[],
): Promise<PlanActionResult> {
  const parsed = planLinesSchema.safeParse(items);
  if (!parsed.success) return { error: "validation" };
  try {
    await addPlanLines(batchId, parsed.data);
    revalidateTms();
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "PLAN_EXCEEDS_AVAILABLE") return { error: "exceedsAvailable" };
    if (msg === "PLAN_BELOW_SCANNED") return { error: "belowScanned" };
    console.error("[tms] addPlanLines:", e);
    return { error: "server" };
  }
}

/** Plandagi tovar sonini o'zgartirish. */
export async function setPlanLineAction(
  batchId: string,
  lineId: string,
  boxes: number,
): Promise<PlanActionResult> {
  try {
    await setPlanLine(batchId, lineId, boxes);
    revalidateTms();
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "PLAN_EXCEEDS_AVAILABLE") return { error: "exceedsAvailable" };
    if (msg === "PLAN_BELOW_SCANNED") return { error: "belowScanned" };
    console.error("[tms] setPlanLine:", e);
    return { error: "server" };
  }
}

export async function removePlanLineAction(batchId: string, lineId: string) {
  await removePlanLine(batchId, lineId);
  revalidateTms();
}

export async function startLoadingAction(batchId: string) {
  await startLoading(batchId);
  revalidateTms();
}

export async function departAction(batchId: string) {
  await departBatch(batchId);
  revalidateTms();
}

/** Qisman jo'natish: scan qilinmagan karobkalar tasdiq bilan skladda qoladi. */
export async function departPartialAction(batchId: string) {
  await departBatch(batchId, { leaveUnscanned: true });
  revalidateTms();
}

export async function arriveAction(batchId: string) {
  await arriveBatch(batchId);
  revalidateTms();
}

export async function unloadAction(batchId: string) {
  await unloadBatch(batchId);
  revalidateTms();
}

export async function closeAction(batchId: string) {
  await closeBatch(batchId);
  revalidateTms();
}

// ─── Scan (yuklash / tushirish) ──────────────────────────────────────────────

/** Sklad tomoni mos kelmasa (masalan jo'natuvchi omborchi tushirish scanini
 * ochsa) service FORBIDDEN_WAREHOUSE tashlaydi — sahifani qulatmasdan
 * skanerda tushunarli natija sifatida ko'rsatamiz. */
function scanErrorResult(e: unknown, code: string): ScanResult {
  const msg = e instanceof Error ? e.message : "";
  if (msg === "FORBIDDEN_WAREHOUSE") return { outcome: "wrong_warehouse", code };
  throw e;
}

export async function scanLoadAction(
  batchId: string,
  _prev: ScanResult | null,
  formData: FormData,
): Promise<ScanResult> {
  const code = String(formData.get("code") ?? "");
  const parsed = scanSchema.safeParse({ code });
  if (!parsed.success) return { outcome: "unknown", code };
  try {
    const res = await scanLoad(batchId, parsed.data.code);
    revalidateTms();
    return res;
  } catch (e) {
    return scanErrorResult(e, code);
  }
}

export async function scanUnloadAction(
  batchId: string,
  _prev: ScanResult | null,
  formData: FormData,
): Promise<ScanResult> {
  const code = String(formData.get("code") ?? "");
  const parsed = scanSchema.safeParse({ code });
  if (!parsed.success) return { outcome: "unknown", code };
  try {
    const res = await scanUnload(batchId, parsed.data.code);
    revalidateTms();
    return res;
  } catch (e) {
    return scanErrorResult(e, code);
  }
}

/** Scan-to-add: "planga qo'shish" tugmasi — tovarni qo'shadi va darhol scan qiladi. */
export async function addLineAndScanAction(
  batchId: string,
  lineId: string,
  code: string,
): Promise<ScanResult> {
  const parsed = scanSchema.safeParse({ code });
  if (!parsed.success) return { outcome: "unknown", code };
  try {
    const res = await addLineAndScanLoad(batchId, lineId, parsed.data.code);
    revalidateTms();
    return res;
  } catch (e) {
    return scanErrorResult(e, code);
  }
}
