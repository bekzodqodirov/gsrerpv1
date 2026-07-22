"use client";

// Yorliqlarni printerga MOSLASH: termal etiket rulonlari (58×40, 40×30 ...) yoki
// A4. Tanlangan o'lcham bo'yicha @page o'lchami + har yorliq aynan shu o'lchamda
// (mm) chiqadi, bittadan sahifada. Ekranda haqiqiy o'lchamda ko'rinadi.
import { useEffect, useState } from "react";

type Label = {
  key: string;
  clientCode: string;
  letterCode: string;
  productName: string;
  qrCode: string;
  position: number;
  boxCount: number;
  qrDataUrl: string;
};

// pw/ph — sahifa (etiket) o'lchami; cw/ch — kartaning o'zi (A4'da markazda kichik).
type Size = {
  id: string;
  name: string;
  pw: number;
  ph: number;
  cw: number;
  ch: number;
};

const SIZES: Size[] = [
  { id: "58x40", name: "58×40 mm", pw: 58, ph: 40, cw: 58, ch: 40 },
  { id: "40x30", name: "40×30 mm", pw: 40, ph: 30, cw: 40, ch: 30 },
  { id: "50x30", name: "50×30 mm", pw: 50, ph: 30, cw: 50, ch: 30 },
  { id: "60x40", name: "60×40 mm", pw: 60, ph: 40, cw: 60, ch: 40 },
  { id: "100x100", name: "100×100 mm", pw: 100, ph: 100, cw: 100, ch: 100 },
  { id: "100x150", name: "100×150 mm", pw: 100, ph: 150, cw: 100, ch: 100 },
  { id: "a4", name: "A4", pw: 210, ph: 297, cw: 150, ch: 100 },
];

/**
 * Har zonaning MILLIMETRDAGI aniq balandligi (jami = karta balandligi — hC
 * shu bilan hisoblanadi, shuning uchun har doim aniq ch ga teng bo'ladi).
 * Aniq balandlik + har qatorda alohida overflow:hidden — zonalar bir-birining
 * USTIGA CHIQMASLIGINI kafolatlaydi (flex-shrink asosidagi eski usulda katta
 * shrift/QR qo'shni qatorga toshib, ustma-ust tushib qolardi).
 */
function metrics(s: Size) {
  const ch = s.ch;
  const cw = s.cw;
  const hA = ch * 0.14; // sklad + qabul sanasi + tartib
  const hB = ch * 0.3; // CLIENT-HARF (asosiy)
  const hD = ch * 0.16; // unikal karobka ID
  const hC = ch - hA - hB - hD; // QR + tovar nomi (qolgan joy — QR shu yerda kattalashadi)
  const padX = cw * 0.06;
  const qr = Math.min(hC * 0.92, cw * 0.5);
  return { ch, cw, hA, hB, hC, hD, padX, qr };
}

/** Matn berilgan balandlik VA kenglikka sig'adigan eng katta shrift (mm). */
function fitFont(maxHeightMm: number, maxWidthMm: number, text: string, charWidth = 0.62): number {
  const byHeight = maxHeightMm * 0.8; // qator ichida joy qoldirish uchun
  const byWidth = maxWidthMm / (Math.max(text.length, 1) * charWidth);
  return Math.max(1, Math.min(byHeight, byWidth));
}

function buildCss(s: Size): string {
  const m = metrics(s);
  const hair = "0.25mm solid #000";
  return `
.lbl-sheet { display:flex; flex-wrap:wrap; gap:10px; align-items:flex-start; }
.lbl-card { width:${m.cw}mm; height:${m.ch}mm; box-sizing:border-box; border:0.35mm solid #000; background:#fff; color:#000; display:flex; flex-direction:column; overflow:hidden; font-family:Arial,Helvetica,sans-serif; }

/* Har zona — FLEX EMAS, aniq mm balandlik (flex:0 0 auto) + o'z overflow'i:
   shu bilan hech qaysi zona qo'shnisiga bosib kirmaydi. */

/* 1-zona: sklad (chapda) + qabul sanasi (o'rtada) + karobka tartibi (o'ngda) */
.lbl-head { height:${m.hA}mm; flex:0 0 auto; box-sizing:border-box; overflow:hidden; display:flex; justify-content:space-between; align-items:center; gap:${m.padX * 0.7}mm; padding:0 ${m.padX}mm; }
.lbl-og { font-weight:900; font-size:${m.hA * 0.62}mm; line-height:1; letter-spacing:0.02em; white-space:nowrap; overflow:hidden; flex:none; }
.lbl-date { flex:1; min-width:0; text-align:center; font-family:monospace; font-weight:600; font-size:${m.hA * 0.42}mm; color:#555; white-space:nowrap; overflow:hidden; }
.lbl-cnt { font-weight:800; font-size:${m.hA * 0.46}mm; border:${hair}; border-radius:1mm; padding:0 ${m.hA * 0.22}mm; white-space:nowrap; flex:none; }

/* 2-zona (ENG MUHIM): CLIENT-HARF — butun kenglikda, bitta qatorda, katta */
.lbl-code { height:${m.hB}mm; flex:0 0 auto; box-sizing:border-box; overflow:hidden; display:flex; align-items:center; justify-content:center; padding:0 ${m.padX}mm; }
.lbl-code span { display:block; font-weight:900; line-height:1; letter-spacing:-0.02em; white-space:nowrap; }

/* 3-zona: QR (chapda) + tovar nomi (o'ngda) */
.lbl-mid { height:${m.hC}mm; flex:0 0 auto; box-sizing:border-box; overflow:hidden; display:flex; align-items:center; gap:${m.padX}mm; padding:0 ${m.padX}mm; }
.lbl-qr { width:${m.qr}mm; height:${m.qr}mm; flex:none; }
.lbl-prod { flex:1; min-width:0; max-height:100%; font-size:${Math.min(m.hC * 0.24, m.cw * 0.09)}mm; font-weight:600; color:#333; line-height:1.2; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }

/* 4-zona: unikal karobka ID — qora chiziqda, HAR DOIM bitta qatorda */
.lbl-foot { height:${m.hD}mm; flex:0 0 auto; box-sizing:border-box; overflow:hidden; display:flex; align-items:center; justify-content:center; background:#000; padding:0 ${m.cw * 0.03}mm; }
.lbl-foot span { display:block; color:#fff; font-family:monospace; font-weight:700; letter-spacing:0.02em; white-space:nowrap; }

@media print {
  @page { size:${s.pw}mm ${s.ph}mm; margin:0; }
  html, body { margin:0 !important; background:#fff !important; }
  .lbl-toolbar, .lbl-hint { display:none !important; }
  .lbl-sheet { display:block; gap:0; }
  .lbl-wrap { display:flex; align-items:center; justify-content:center; width:${s.pw}mm; height:${s.ph}mm; break-after:page; page-break-after:always; }
  .lbl-wrap:last-child { break-after:auto; page-break-after:auto; }
}
`;
}

export function LabelSheet({
  labels,
  header,
  title,
  regNumber,
  lineCode,
  labels_i18n: L,
}: {
  labels: Label[];
  header: { originGs: string; originName: string; receivedDate: string };
  title: string;
  regNumber: string;
  lineCode: string | null;
  labels_i18n: { print: string; labelSize: string };
}) {
  const [sizeId, setSizeId] = useState("58x40");
  const [ready, setReady] = useState(false);
  // localStorage'dan tiklash (mount'dan keyin, SSR-xavfsiz).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const saved = localStorage.getItem("labelSize");
    if (saved && SIZES.some((s) => s.id === saved)) setSizeId(saved);
    setReady(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (ready) localStorage.setItem("labelSize", sizeId);
  }, [sizeId, ready]);

  const size = SIZES.find((s) => s.id === sizeId) ?? SIZES[0];
  const m = metrics(size);

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: buildCss(size) }} />

      <div className="lbl-toolbar mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold sm:text-2xl">
          {title} — <span className="font-mono">{regNumber}</span>{" "}
          {lineCode && <span className="font-mono text-primary">· {lineCode}</span>}{" "}
          <span className="font-normal text-muted">({labels.length})</span>
        </h1>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm">
            <span className="text-muted">{L.labelSize}</span>
            <select
              value={sizeId}
              onChange={(e) => setSizeId(e.target.value)}
              className="h-9 rounded-lg border border-line bg-surface px-2 text-sm outline-none focus:border-primary"
            >
              {SIZES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover"
          >
            {L.print}
          </button>
        </div>
      </div>

      <p className="lbl-hint mb-3 text-xs text-muted">
        {size.name} · Print oynasida <b>Margins: None</b> qo&apos;ying.
      </p>

      <div className="lbl-sheet">
        {labels.map((b) => {
          const codeText = `${b.clientCode}-${b.letterCode}`;
          const codeFont = fitFont(m.hB, m.cw - 2 * m.padX, codeText);
          const footPadX = m.cw * 0.03;
          const footFont = fitFont(m.hD, m.cw - 2 * footPadX, b.qrCode);
          return (
            <div className="lbl-wrap" key={b.key}>
              <div className="lbl-card">
                <div className="lbl-head">
                  <span className="lbl-og">{header.originGs}</span>
                  <span className="lbl-date">{header.receivedDate}</span>
                  <span className="lbl-cnt">
                    {b.position}/{b.boxCount}
                  </span>
                </div>
                <div className="lbl-code">
                  <span style={{ fontSize: `${codeFont}mm` }}>{codeText}</span>
                </div>
                <div className="lbl-mid">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="lbl-qr" src={b.qrDataUrl} alt={b.qrCode} />
                  <div className="lbl-prod">{b.productName}</div>
                </div>
                <div className="lbl-foot">
                  <span style={{ fontSize: `${footFont}mm` }}>{b.qrCode}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
