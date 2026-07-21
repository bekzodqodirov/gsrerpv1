"use server";

import { revalidatePath } from "next/cache";
import { receiveCargo, updateCargo } from "@/modules/cargo/service";
import { receiveCargoSchema } from "@/modules/cargo/dto";
import { saveAttachment } from "@/modules/shared/attachments";
import { getSession } from "@/modules/shared/auth";
import { db } from "@/db";
import { cargoLines } from "@/db/schema";
import { asc, eq } from "drizzle-orm";

export type CargoFormState = {
  error?: string;
  createdReg?: string;
  createdId?: string;
};

/** Yangi qabul yoki mavjud prixodni tahrirlash — cargoId maydoni bor-yo'qligiga qarab. */
export async function receiveCargoAction(
  _prev: CargoFormState,
  formData: FormData,
): Promise<CargoFormState> {
  let linesRaw: unknown;
  try {
    linesRaw = JSON.parse(String(formData.get("linesJson") ?? "[]"));
  } catch {
    return { error: "validation" };
  }

  const parsed = receiveCargoSchema.safeParse({
    clientId: String(formData.get("clientId") ?? ""),
    originWarehouseId: String(formData.get("originWarehouseId") ?? ""),
    note: String(formData.get("note") ?? ""),
    lines: linesRaw,
  });
  if (!parsed.success) {
    console.error("[cargo] validation:", JSON.stringify(parsed.error.issues));
    return { error: "validation" };
  }

  const cargoId = String(formData.get("cargoId") ?? "").trim() || null;

  try {
    const cargo = cargoId
      ? await updateCargo(cargoId, parsed.data)
      : await receiveCargo(parsed.data);
    const session = (await getSession())!;

    // Prixod fayllari (excel/word/pdf/rasm)
    const files = formData
      .getAll("files")
      .filter((f): f is File => f instanceof File && f.size > 0);
    for (const f of files.slice(0, 10)) {
      await saveAttachment("cargo", cargo.id, f, session.sub);
    }

    // Qator rasmlari: linePhotos_0, linePhotos_1, ...
    const savedLines = await db.query.cargoLines.findMany({
      where: eq(cargoLines.cargoId, cargo.id),
      orderBy: asc(cargoLines.lineNo),
    });
    for (let i = 0; i < savedLines.length; i++) {
      const photos = formData
        .getAll(`linePhotos_${i}`)
        .filter((f): f is File => f instanceof File && f.size > 0);
      for (const p of photos.slice(0, 10)) {
        await saveAttachment("cargo_line", savedLines[i].id, p, session.sub);
      }
    }

    revalidatePath("/[locale]/cargo", "page");
    revalidatePath("/[locale]/cargo/[id]", "page");
    return { createdReg: cargo.regNumber, createdId: cargo.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "CARGO_LOCKED") return { error: "cargoLocked" };
    console.error("[cargo] server error:", e);
    return { error: "server" };
  }
}
