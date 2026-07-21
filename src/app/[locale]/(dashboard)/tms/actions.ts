"use server";

import { revalidatePath } from "next/cache";
import {
  createBatch,
  createCarrier,
  setCarrierActive,
  addCargoToBatch,
  removeCargoFromBatch,
  startLoading,
  departBatch,
  arriveBatch,
  unloadBatch,
  closeBatch,
  scanLoad,
  scanUnload,
} from "@/modules/tms/service";
import {
  batchCreateSchema,
  carrierSchema,
  scanSchema,
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
    console.error("[tms] createBatch:", e);
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

export async function addCargoAction(batchId: string, cargoId: string) {
  await addCargoToBatch(batchId, cargoId);
  revalidateTms();
}

export async function removeCargoAction(batchId: string, cargoId: string) {
  await removeCargoFromBatch(batchId, cargoId);
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

export async function scanLoadAction(
  batchId: string,
  _prev: ScanResult | null,
  formData: FormData,
): Promise<ScanResult> {
  const code = String(formData.get("code") ?? "");
  const parsed = scanSchema.safeParse({ code });
  if (!parsed.success) return { outcome: "unknown", code };
  const res = await scanLoad(batchId, parsed.data.code);
  revalidateTms();
  return res;
}

export async function scanUnloadAction(
  batchId: string,
  _prev: ScanResult | null,
  formData: FormData,
): Promise<ScanResult> {
  const code = String(formData.get("code") ?? "");
  const parsed = scanSchema.safeParse({ code });
  if (!parsed.success) return { outcome: "unknown", code };
  const res = await scanUnload(batchId, parsed.data.code);
  revalidateTms();
  return res;
}
