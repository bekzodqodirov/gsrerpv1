// Biriktirilgan fayllarni berish (faqat tizimga kirganlarga).
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/modules/shared/auth";
import { getAttachment, readAttachmentBytes } from "@/modules/shared/attachments";

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

  const buf = await readAttachmentBytes(att);
  if (!buf) {
    return NextResponse.json({ error: "file_missing" }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": att.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(att.fileName)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
