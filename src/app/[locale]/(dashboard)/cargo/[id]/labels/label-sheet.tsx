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

function buildCss(s: Size): string {
  const ch = s.ch;
  const pad = ch * 0.05;
  const qr = Math.min(s.cw * 0.42, ch * 0.6);
  const hair = "0.3mm solid #000";
  return `
.lbl-sheet { display:flex; flex-wrap:wrap; gap:10px; align-items:flex-start; }
.lbl-card { width:${s.cw}mm; height:${s.ch}mm; box-sizing:border-box; border:${hair}; background:#fff; color:#000; padding:${pad}mm; display:flex; flex-direction:column; overflow:hidden; font-family:Arial,Helvetica,sans-serif; }
.lbl-top { display:flex; justify-content:space-between; align-items:baseline; gap:${ch * 0.04}mm; border-bottom:${hair}; padding-bottom:${ch * 0.03}mm; }
.lbl-og { font-weight:900; font-size:${ch * 0.1}mm; line-height:1; }
.lbl-on { font-size:${ch * 0.06}mm; color:#444; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.lbl-mid { flex:1; display:flex; align-items:center; gap:${ch * 0.05}mm; padding:${ch * 0.03}mm 0; min-height:0; }
.lbl-codecol { flex:1; min-width:0; }
.lbl-code { font-weight:900; font-size:${ch * 0.24}mm; line-height:0.95; letter-spacing:-0.02em; }
.lbl-prod { font-size:${ch * 0.085}mm; font-weight:600; color:#222; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; margin-top:${ch * 0.03}mm; }
.lbl-qr { width:${qr}mm; height:${qr}mm; flex:none; }
.lbl-bot { display:flex; justify-content:space-between; align-items:center; gap:${ch * 0.04}mm; border-top:${hair}; padding-top:${ch * 0.03}mm; }
.lbl-id { font-family:monospace; font-weight:700; font-size:${ch * 0.08}mm; white-space:nowrap; }
.lbl-pos { font-weight:900; font-size:${ch * 0.08}mm; background:#000; color:#fff; padding:0 ${ch * 0.05}mm; border-radius:0.5mm; }
@media print {
  @page { size:${s.pw}mm ${s.ph}mm; margin:0; }
  html, body { margin:0 !important; background:#fff !important; }
  .lbl-toolbar, .lbl-hint { display:none !important; }
  .lbl-sheet { display:block; gap:0; }
  .lbl-wrap { display:flex; align-items:center; justify-content:center; width:${s.pw}mm; height:${s.ph}mm; break-after:page; page-break-after:always; }
  .lbl-wrap:last-child { break-after:auto; page-break-after:auto; }
  .lbl-card { border:${s.id === "a4" ? hair : "none"}; }
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
              <div className="lbl-top">
                <span className="lbl-og">{header.originGs}</span>
                <span className="lbl-on">{header.originName}</span>
              </div>
              <div className="lbl-mid">
                <div className="lbl-codecol">
                  <div className="lbl-code">
                    {b.clientCode}-{b.letterCode}
                  </div>
                  <div className="lbl-prod">{b.productName}</div>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="lbl-qr" src={b.qrDataUrl} alt={b.qrCode} />
              </div>
              <div className="lbl-bot">
                <span className="lbl-id">{b.qrCode}</span>
                <span className="lbl-pos">
                  {b.position}/{b.boxCount}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
