// Rasmni brauzerda (yuborishdan oldin) siqadi — sifatni sezilarli tushirmasdan.
// Maqsad: bazaga kichik, lekin toza rasm saqlash + server action body limitiga
// urilmaslik. Katta o'lchamli telefon rasmi 5–8 MB dan ~200–500 KB gacha tushadi.
//
// Usul: rasmni maksimal tomoni MAX_DIM bo'lguncha proporsional kichraytiramiz
// (agar kichik bo'lsa — teginmaymiz), so'ng WebP (yuqori sifat) ga qayta kodlaymiz.
// WebP JPEG'dan ~25–35% kichik, xuddi shu ko'rinishda. Foyda bo'lmasa asl fayl
// qaytariladi. Rasm bo'lmagan fayllar (pdf/excel) o'zgarishsiz o'tadi.

const MAX_DIM = 2200; // px — chop/ko'rish uchun mo'l-ko'l
const QUALITY = 0.9; // WebP sifati (0..1) — "sifatini tushirmasdan"

function isCompressible(file: File): boolean {
  return (
    file.type.startsWith("image/") &&
    file.type !== "image/heic" &&
    file.type !== "image/heif" &&
    file.type !== "image/gif" // animatsiya buzilmasin
  );
}

export async function compressImage(file: File): Promise<File> {
  if (typeof document === "undefined") return file;
  if (!isCompressible(file)) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // dekod bo'lmasa — aslini yuboramiz
  }

  const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", QUALITY),
  );
  // Foyda bo'lmasa (yoki brauzer webp bermasa) — asl faylni qoldiramiz.
  if (!blob || blob.size >= file.size) return file;

  const baseName = file.name.replace(/\.[^.]+$/, "");
  return new File([blob], `${baseName}.webp`, {
    type: "image/webp",
    lastModified: file.lastModified,
  });
}

/** Bir nechta faylni ketma-ket siqadi (xotira portlashining oldini oladi). */
export async function compressImages(files: File[]): Promise<File[]> {
  const out: File[] = [];
  for (const f of files) out.push(await compressImage(f));
  return out;
}
