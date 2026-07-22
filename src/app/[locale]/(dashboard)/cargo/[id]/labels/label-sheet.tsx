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

/** CLIENT-HARF kodini bitta qatorga sig'diradigan shrift o'lchami (mm). */
function codeFontMm(s: Size, text: string): number {
  const gx = s.ch * 0.06;
  const avail = s.cw - 2 * gx; // mm
  const fit = avail / (Math.max(text.length, 1) * 0.62); // qalin Arial ~0.62em/belgi
  return Math.min(s.ch * 0.34, fit);
}

function buildCss(s: Size): string {
  const ch = s.ch;
  const cw = s.cw;
  const gx = ch * 0.06;
  const qr = Math.min(cw * 0.4, ch * 0.44);
  const hair = "0.25mm solid #000";
  return `
.lbl-sheet { display:flex; flex-wrap:wrap; gap:10px; align-items:flex-start; }
.lbl-card { width:${cw}mm; height:${ch}mm; box-sizing:border-box; border:0.35mm solid #000; background:#fff; color:#000; display:flex; flex-direction:column; overflow:hidden; font-family:Arial,Helvetica,sans-serif; }

/* 1-zona: sklad (chapda) + karobka tartibi (o'ngda) — kichik */
.lbl-head { display:flex; justify-content:space-between; align-items:center; gap:${gx}mm; padding:${ch * 0.05}mm ${gx}mm 0; }
.lbl-og { font-weight:900; font-size:${ch * 0.1}mm; line-height:1; letter-spacing:0.02em; }
.lbl-cnt { font-weight:800; font-size:${ch * 0.09}mm; border:${hair}; border-radius:1mm; padding:0 ${ch * 0.05}mm; white-space:nowrap; }

/* 2-zona (ENG MUHIM): CLIENT-HARF — butun kenglikda, bitta qatorda, katta */
.lbl-code { font-weight:900; line-height:1; letter-spacing:-0.02em; white-space:nowrap; overflow:hidden; text-align:center; padding:${ch * 0.02}mm ${gx}mm; }

/* 3-zona: QR (chapda) + tovar nomi (o'ngda) */
.lbl-mid { flex:1; min-height:0; display:flex; align-items:center; gap:${gx}mm; padding:0 ${gx}mm ${ch * 0.02}mm; }
.lbl-qr { width:${qr}mm; height:${qr}mm; flex:none; }
.lbl-prod { flex:1; min-width:0; font-size:${ch * 0.1}mm; font-weight:600; color:#333; line-height:1.15; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }

/* 4-zona: unikal karobka ID — qora chiziqda, aniq ajralib turadi */
.lbl-foot { background:#000; color:#fff; text-align:center; font-family:monospace; font-weight:700; font-size:${ch * 0.1}mm; letter-spacing:0.04em; padding:${ch * 0.045}mm 0; }

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
        {labels.map((b) => (
          <div className="lbl-wrap" key={b.key}>
            <div className="lbl-card">
              <div className="lbl-head">
                <span className="lbl-og">{header.originGs}</span>
                <span className="lbl-cnt">
                  {b.position}/{b.boxCount}
                </span>
              </div>
              <div
                className="lbl-code"
                style={{
                  fontSize: `${codeFontMm(size, `${b.clientCode}-${b.letterCode}`)}mm`,
                }}
              >
                {b.clientCode}-{b.letterCode}
              </div>
              <div className="lbl-mid">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="lbl-qr" src={b.qrDataUrl} alt={b.qrCode} />
                <div className="lbl-prod">{b.productName}</div>
              </div>
              <div className="lbl-foot">{b.qrCode}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
