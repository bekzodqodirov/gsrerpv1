"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Link, useRouter } from "@/i18n/routing";
import { Card, Button, Badge } from "@/components/ui";
import { icons } from "@/components/icons";
import type { PackResult, PackOutcome } from "@/modules/repack/dto";
import {
  packBoxAction,
  unpackBoxAction,
  setPalletStatusAction,
  deletePalletAction,
} from "../actions";

type Box = {
  id: string;
  qrCode: string;
  cargoId: string;
  regNumber: string;
  letterCode: string;
  productName: string;
  weightKg: number;
  volumeM3: number;
};
type Totals = { count: number; weightKg: number; volumeM3: number };
type Labels = Record<string, string>;

const GOOD: PackOutcome[] = ["packed", "moved", "already_here"];
const OUTCOME_CLS: Record<PackOutcome, string> = {
  packed: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100",
  moved: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100",
  already_here: "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100",
  wrong_client: "bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100",
  not_here: "bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100",
  pallet_closed: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200",
  unknown: "bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100",
};

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
    /* ovozsiz */
  }
}

export function PackPanel({
  palletId,
  code,
  status,
  clientCode,
  clientName,
  warehouseGsCode,
  warehouseName,
  boxes,
  totals,
  labels: L,
}: {
  palletId: string;
  code: string;
  status: string;
  clientCode: string;
  clientName: string;
  warehouseGsCode: string;
  warehouseName: string;
  boxes: Box[];
  totals: Totals;
  labels: Labels;
}) {
  const router = useRouter();
  const open = status === "open";
  const [manual, setManual] = useState("");
  const [camOn, setCamOn] = useState(false);
  const [last, setLast] = useState<PackResult | null>(null);
  const [busy, setBusy] = useState(false);
  const lastScanRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const handleScan = useCallback(
    async (raw: string) => {
      const c = raw.trim();
      if (!c || busy) return;
      const now = Date.now();
      if (lastScanRef.current.code === c && now - lastScanRef.current.at < 1500)
        return;
      lastScanRef.current = { code: c, at: now };
      setBusy(true);
      try {
        const r = await packBoxAction(palletId, c);
        setLast(r);
        beep(GOOD.includes(r.outcome));
        if (r.outcome === "packed" || r.outcome === "moved") router.refresh();
      } finally {
        setBusy(false);
      }
    },
    [palletId, busy, router],
  );

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

  async function remove(boxId: string) {
    await unpackBoxAction(palletId, boxId);
    router.refresh();
  }
  async function toggleStatus() {
    await setPalletStatusAction(palletId, open ? "closed" : "open");
    router.refresh();
  }
  async function del() {
    if (!confirm(L.confirmDelete)) return;
    await deletePalletAction(palletId);
    router.push("/repack");
  }

  return (
    <div className="space-y-4">
      <Link
        href="/repack"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        ← {L.back}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-mono text-xl font-bold sm:text-2xl">{code}</h1>
            <Badge
              className={
                open
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                  : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
              }
            >
              {open ? L.status_open : L.status_closed}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted">
            <span className="font-mono font-semibold text-foreground">
              {clientCode}
            </span>{" "}
            {clientName} · <span className="font-mono">{warehouseGsCode}</span>{" "}
            {warehouseName}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/repack/${palletId}/label`}
            target="_blank"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-medium hover:bg-surface-2"
          >
            {icons.printer("h-4 w-4")}
            {L.print}
          </a>
          <Button variant="outline" size="sm" onClick={toggleStatus}>
            {open ? L.close : L.reopen}
          </Button>
          {totals.count === 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={del}
              className="text-red-600"
            >
              {L.delete}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:max-w-md">
        <Stat value={totals.count} label={L.boxes} />
        <Stat value={`${totals.weightKg} ${L.kg}`} label={L.weight} />
        <Stat value={`${totals.volumeM3} ${L.m3}`} label={L.volume} />
      </div>

      {/* Scan-to-pack (faqat ochiq yashik uchun) */}
      {open ? (
        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold">{L.scanTitle}</h2>
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
                  placeholder={L.scanPlaceholder}
                  className="h-10 flex-1 rounded-lg border border-line bg-surface px-3 font-mono text-sm outline-none focus:border-primary"
                />
                <Button type="submit" size="sm" disabled={busy}>
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
                    OUTCOME_CLS[last.outcome]
                  }
                >
                  {L[`out_${last.outcome}`]} · {last.code}
                  {last.label ? ` · ${last.label}` : ""}
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
      ) : (
        <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted">
          {L.closedNote}
        </p>
      )}

      {/* Yashikdagi karobkalar */}
      <div className="overflow-hidden rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead className="bg-surface-2/60 text-left">
            <tr>
              <th className="px-3 py-2 font-semibold">{L.qr}</th>
              <th className="px-3 py-2 font-semibold">{L.letter}</th>
              <th className="px-3 py-2 font-semibold">{L.product}</th>
              <th className="px-3 py-2 text-right font-semibold">{L.weight}</th>
              {open && <th className="px-3 py-2"></th>}
            </tr>
          </thead>
          <tbody>
            {boxes.length === 0 ? (
              <tr>
                <td
                  colSpan={open ? 5 : 4}
                  className="px-3 py-8 text-center text-muted"
                >
                  {L.empty}
                </td>
              </tr>
            ) : (
              boxes.map((b) => (
                <tr key={b.id} className="border-t border-line/60">
                  <td className="px-3 py-1.5 font-mono text-xs">{b.qrCode}</td>
                  <td className="px-3 py-1.5 font-mono text-sm font-black">
                    {clientCode}-{b.letterCode}
                  </td>
                  <td className="px-3 py-1.5">{b.productName}</td>
                  <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                    {Math.round(b.weightKg * 1000) / 1000}
                  </td>
                  {open && (
                    <td className="px-3 py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => remove(b.id)}
                        className="text-xs font-medium text-red-500 hover:underline"
                      >
                        {L.remove}
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <Card className="p-3 text-center">
      <div className="font-mono text-lg font-bold tabular-nums">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </Card>
  );
}
