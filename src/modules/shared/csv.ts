// CSV yasash — Excel'da ochiladi. BOM qo'shiladi (UTF-8 kirillcha/xitoycha uchun).
export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const esc = (v: string | number | null): string => {
    const s = v == null ? "" : String(v);
    // Vergul/qo'shtirnoq/yangi qator bo'lsa — qo'shtirnoqqa olamiz.
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers, ...rows].map((r) => r.map(esc).join(","));
  return "﻿" + lines.join("\r\n");
}

/** CSV javobi (fayl sifatida yuklab olinadi). */
export function csvResponse(filename: string, csv: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
