"use server";

// Tovar nomini xitoychadan foydalanuvchi tiliga tarjima qilish (yordamchi).
// Google Translate'ning kalitsiz ochiq endpointidan foydalanamiz — barqaror
// xizmat emas, shu sababli har doim graceful fallback (xato bo'lsa — null).
const CJK_RE = /[一-鿿]/;

// Ilova tili → Google Translate tili kodi (xitoy manba tili uchun mos target).
const TARGET: Record<string, string> = { uz: "uz", ru: "ru", en: "en", zh: "ru" };

export async function translateProductNameAction(
  text: string,
  locale = "ru",
): Promise<string | null> {
  const trimmed = text.trim();
  if (!trimmed || !CJK_RE.test(trimmed)) return null;
  const tl = TARGET[locale] ?? "ru";

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-CN&tl=${tl}&dt=t&q=${encodeURIComponent(trimmed)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;

    const data: unknown = await res.json();
    if (!Array.isArray(data) || !Array.isArray(data[0])) return null;

    const translated = (data[0] as unknown[])
      .map((chunk) => (Array.isArray(chunk) ? String(chunk[0] ?? "") : ""))
      .join("")
      .trim();

    return translated || null;
  } catch {
    return null;
  }
}
