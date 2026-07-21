"use server";

import QRCode from "qrcode";
import { getLineQr } from "@/modules/cargo/service";

/** Bitta tovar (qator) uchun QR rasm — shu tovarning BARCHA karobkalari bir xil kodni oladi. */
export async function getLineQrPreviewAction(lineId: string): Promise<{
  qrCode: string;
  letterCode: string;
  boxCount: number;
  dataUrl: string;
} | null> {
  const line = await getLineQr(lineId);
  if (!line || !line.qrCode) return null;

  const dataUrl = await QRCode.toDataURL(line.qrCode, { width: 220, margin: 1 });
  return { ...line, qrCode: line.qrCode, dataUrl };
}
