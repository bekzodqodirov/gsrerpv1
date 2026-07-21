// Biriktirilgan fayllarni berish (faqat tizimga kirganlarga).
import { readFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/modules/shared/auth";
import { getAttachment, UPLOAD_DIR } from "@/modules/shared/attachments";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const att = await getAttachment(id);
  if (!att) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const buf = await readFile(path.join(UPLOAD_DIR, att.storedName));
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": att.mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(att.fileName)}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "file_missing" }, { status: 404 });
  }
}
