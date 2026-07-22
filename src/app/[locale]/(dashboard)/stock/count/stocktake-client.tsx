"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import jsQR from "jsqr";
import { Card, Button } from "@/components/ui";
import { icons } from "@/components/icons";

type Box = {
  qrCode: string;
  clientCode: string;
  clientName: string;
  letterCode: string;
  productName: string;
  days: number;
  cargoId: string;
  regNumber: string;
};

type Labels = Record<string, string>;
type Outcome = "found" | "duplicate" | "extra";

function beep(good: boolean) {
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = good ? 880 : 220;
    g.gain.value = 0.08;
    o.start();
    o.stop(ctx.currentTime + (good ? 0.09 : 0.22));
    o.onended = () => ctx.close();
  } catch {
    /* ovozsiz — muhim emas */
  }
}

const OUTCOME_STYLE: Record<Outcome, string> = {
  found: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100",
  duplicate: "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100",
  extra: "bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100",
};

export function StocktakeClient({
  boxes,
  warehouseLabel,
  labels: L,
}: {
  boxes: Box[];
  warehouseLabel: string;
  labels: Labels;
}) {
  const expectedSet = useMemo(
    () => new Set(boxes.map((b) => b.qrCode.toUpperCase())),
    [boxes],
  );
  const [scanned, setScanned] = useState<Set<string>>(new Set());
  const [extra, setExtra] = useState<string[]>([]);
  const [last, setLast] = useState<{ code: string; outcome: Outcome } | null>(
    null,
  );
  const [manual, setManual] = useState("");
  const [camOn, setCamOn] = useState(false);

  const lastScanRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const handleScan = useCallback(
    (raw: string) => {
      const code = raw.trim().toUpperCase();
      if (!code) return;
      // Kamera bir kodni ketma-ket o'qishini bostirish (1.2s ichida takror emas).
      const now = Date.now();
      if (lastScanRef.current.code === code && now - lastScanRef.current.at < 1200)
        return;
      lastScanRef.current = { code, at: now };

      let outcome: Outcome;
      if (expectedSet.has(code)) {
        if (scanned.has(code)) outcome = "duplicate";
        else {
          setScanned((prev) => new Set(prev).add(code));
          outcome = "found";
        }
      } else {
        if (extra.includes(code)) outcome = "duplicate";
        else {
          setExtra((prev) => [code, ...prev]);
          outcome = "extra";
        }
      }
      setLast({ code, outcome });
      beep(outcome === "found");
    },
    [expectedSet, scanned, extra],
  );

  // Kamera oqimi
  useEffect(() => {
    if (!camOn) return;
    let raf = 0;
    let cancelled = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        streamRef.current = stream;
        const v = videoRef.current!;
        v.srcObject = stream;
        await v.play();
        const tick = () => {
          if (cancelled) return;
          if (v.readyState === v.HAVE_ENOUGH_DATA && ctx) {
            canvas.width = v.videoWidth;
            canvas.height = v.videoHeight;
            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const r = jsQR(img.data, img.width, img.height);
            if (r?.data) handleScan(r.data);
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch {
        setCamOn(false);
      }
    }
    start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    };
  }, [camOn, handleScan]);

  const foundCount = scanned.size;
  const missingBoxes = boxes.filter((b) => !scanned.has(b.qrCode.toUpperCase()));
  const total = boxes.length;
  const pct = total ? Math.round((foundCount / total) * 100) : 0;

  function reset() {
    setScanned(new Set());
    setExtra([]);
    setLast(null);
    lastScanRef.current = { code: "", at: 0 };
  }

  function exportCsv() {
    const esc = (s: string) =>
      /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    const rows: string[] = [
      ["status", "qr", "client", "letter", "product", "reg", "age_days"].join(","),
    ];
    for (const b of missingBoxes)
      rows.push(
        [
          "MISSING",
          b.qrCode,
          b.clientCode,
          `${b.clientCode}-${b.letterCode}`,
          b.productName,
          b.regNumber,
          String(b.days),
        ]
          .map(esc)
          .join(","),
      );
    for (const code of extra)
      rows.push(["EXTRA", code, "", "", "", "", ""].map(esc).join(","));
    const csv = "﻿" + rows.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inventarizatsiya.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold sm:text-2xl">
          {L.title}{" "}
          <span className="font-normal text-muted">· {warehouseLabel}</span>
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={reset}>
            {L.reset}
          </Button>
          <Button
            size="sm"
            onClick={exportCsv}
            disabled={missingBoxes.length === 0 && extra.length === 0}
          >
            {L.exportCsv}
          </Button>
        </div>
      </div>

      {/* Hisoblagichlar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat n={total} label={L.expected} tone="" />
        <Stat n={foundCount} label={L.found} tone="text-emerald-600 dark:text-emerald-400" />
        <Stat n={missingBoxes.length} label={L.missing} tone="text-red-600 dark:text-red-400" />
        <Stat n={extra.length} label={L.extra} tone="text-orange-600 dark:text-orange-400" />
      </div>

      {/* Jarayon chizig'i */}
      <div>
        <div className="mb-1 flex justify-between text-xs text-muted">
          <span>{L.progress}</span>
          <span className="font-mono font-bold tabular-nums">
            {foundCount}/{total} · {pct}%
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Scan kirish: kamera + qo'lda/scanner */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex-1">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleScan(manual);
                setManual("");
              }}
              className="flex gap-2"
            >
              <input
                autoFocus
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder={L.manualPlaceholder}
                className="h-10 flex-1 rounded-lg border border-line bg-surface px-3 font-mono text-sm outline-none focus:border-primary"
              />
              <Button type="submit" size="sm">
                {L.add}
              </Button>
            </form>
            <button
              type="button"
              onClick={() => setCamOn((v) => !v)}
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              {icons.camera("h-4 w-4")}
              {camOn ? L.stopCamera : L.camera}
            </button>
            {last && (
              <div
                className={
                  "mt-3 rounded-lg px-3 py-2 font-mono text-sm font-semibold " +
                  OUTCOME_STYLE[last.outcome]
                }
              >
                {last.outcome === "found"
                  ? L.outcomeFound
                  : last.outcome === "duplicate"
                    ? L.outcomeDuplicate
                    : L.outcomeExtra}{" "}
                · {last.code}
              </div>
            )}
          </div>
          {camOn && (
            <video
              ref={videoRef}
              muted
              playsInline
              className="w-full rounded-lg border border-line sm:w-64"
            />
          )}
        </div>
      </Card>

      {/* Yo'q va begona ro'yxatlari */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold text-red-600 dark:text-red-400">
            {L.missingList} ({missingBoxes.length})
          </h2>
          {missingBoxes.length === 0 ? (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              ✓ {L.allScanned}
            </p>
          ) : (
            <div className="max-h-96 overflow-y-auto rounded-lg border border-line">
              <table className="w-full text-sm">
                <tbody>
                  {missingBoxes.map((b) => (
                    <tr key={b.qrCode} className="border-b border-line/60 last:border-0">
                      <td className="px-3 py-1.5 font-mono text-xs">{b.qrCode}</td>
                      <td className="px-2 py-1.5 font-mono text-xs font-black">
                        {b.clientCode}-{b.letterCode}
                      </td>
                      <td className="px-2 py-1.5 text-muted">{b.productName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div>
          <h2 className="mb-2 text-sm font-semibold text-orange-600 dark:text-orange-400">
            {L.extraList} ({extra.length})
          </h2>
          {extra.length === 0 ? (
            <p className="text-sm text-muted">—</p>
          ) : (
            <div className="max-h-96 overflow-y-auto rounded-lg border border-line">
              <table className="w-full text-sm">
                <tbody>
                  {extra.map((c) => (
                    <tr key={c} className="border-b border-line/60 last:border-0">
                      <td className="px-3 py-1.5 font-mono text-xs">{c}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <Card className="p-3 text-center">
      <div className={"font-mono text-2xl font-bold tabular-nums " + tone}>{n}</div>
      <div className="text-xs text-muted">{label}</div>
    </Card>
  );
}
