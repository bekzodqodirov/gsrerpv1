"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import jsQR from "jsqr";
import { Card, Button } from "@/components/ui";
import { icons } from "@/components/icons";
import type { ScanResult } from "@/modules/tms/dto";
import {
  scanLoadAction,
  scanUnloadAction,
  addCargoAndScanAction,
} from "../actions";

type Mode = "load" | "unload";

// Natija turiga qarab rang va "ijobiy"lik (ovoz uchun).
const OUTCOME_STYLE: Record<
  string,
  { cls: string; good: boolean }
> = {
  loaded: { cls: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100", good: true },
  unloaded: { cls: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100", good: true },
  duplicate: { cls: "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100", good: false },
  can_add: { cls: "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100", good: false },
  not_on_plan: { cls: "bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100", good: false },
  extra: { cls: "bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100", good: false },
  unknown: { cls: "bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100", good: false },
  wrong_status: { cls: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200", good: false },
};

function beep(good: boolean) {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
    /* ovoz ixtiyoriy */
  }
}

export function ScanPanel({
  batchId,
  mode,
  done,
  total,
}: {
  batchId: string;
  mode: Mode;
  done: number;
  total: number;
}) {
  const t = useTranslations("tms");
  const action = mode === "load" ? scanLoadAction : scanUnloadAction;
  const [state, formAction, pending] = useActionState<ScanResult | null, FormData>(
    action.bind(null, batchId),
    null,
  );

  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [camOn, setCamOn] = useState(false);
  const [camErr, setCamErr] = useState<string | null>(null);
  // "Planga qo'shish" natijasi — qaysi scan javobiga tegishliligi bilan birga
  // saqlanadi: yangi scan kelsa (state almashsa) o'z-o'zidan eskiradi.
  const [override, setOverride] = useState<{
    base: ScanResult;
    result: ScanResult;
  } | null>(null);
  const [adding, setAdding] = useState(false);
  const lastScan = useRef<{ code: string; at: number }>({ code: "", at: 0 });

  // Har javobdan keyin ovoz + inputni tozalab, fokusni qaytaramiz.
  useEffect(() => {
    if (!state) return;
    beep(OUTCOME_STYLE[state.outcome]?.good ?? false);
    if (inputRef.current) inputRef.current.value = "";
    inputRef.current?.focus();
  }, [state]);

  async function handleAddToPlan(res: ScanResult) {
    if (!res.cargoId || adding) return;
    setAdding(true);
    try {
      const r = await addCargoAndScanAction(batchId, res.cargoId, res.code);
      setOverride({ base: res, result: r });
      beep(OUTCOME_STYLE[r.outcome]?.good ?? false);
    } finally {
      setAdding(false);
      inputRef.current?.focus();
    }
  }

  // Kamera: jsQR bilan har kadrni o'qiymiz.
  useEffect(() => {
    if (!camOn) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let active = true;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (!active) return;
        const v = videoRef.current!;
        v.srcObject = stream;
        await v.play();
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        const tick = () => {
          if (!active) return;
          if (v.readyState === v.HAVE_ENOUGH_DATA) {
            canvas.width = v.videoWidth;
            canvas.height = v.videoHeight;
            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const qr = jsQR(img.data, img.width, img.height);
            if (qr?.data) {
              const now = Date.now();
              const dup =
                qr.data === lastScan.current.code &&
                now - lastScan.current.at < 2000;
              if (!dup) {
                lastScan.current = { code: qr.data, at: now };
                if (inputRef.current) inputRef.current.value = qr.data;
                formRef.current?.requestSubmit();
              }
            }
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch {
        setCamErr(t("cameraError"));
        setCamOn(false);
      }
    })();

    return () => {
      active = false;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, [camOn, t]);

  const shown = override && override.base === state ? override.result : state;
  const shownDone = shown?.total != null ? shown.done! : done;
  const shownTotal = shown?.total != null ? shown.total : total;
  const pct = shownTotal ? Math.min(100, (shownDone / shownTotal) * 100) : 0;
  const complete = shownTotal > 0 && shownDone >= shownTotal;

  return (
    <Card className="p-4 print:hidden">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          {mode === "load" ? t("scanLoad") : t("scanUnload")}
        </h2>
        <span
          className={
            "font-mono text-sm font-bold tabular-nums " +
            (complete ? "text-emerald-600" : "text-foreground")
          }
        >
          {shownDone} / {shownTotal}
        </span>
      </div>

      {/* progress */}
      <div className="mb-3 h-2.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className={"h-full rounded-full transition-all " + (complete ? "bg-emerald-500" : "bg-primary")}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* kamera */}
      {camOn && (
        <div className="mb-3 overflow-hidden rounded-lg border border-line">
          <video ref={videoRef} className="w-full max-h-64 object-cover" muted playsInline />
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />

      {/* skaner / qo'lda kiritish */}
      <form ref={formRef} action={formAction} className="flex gap-2">
        <input
          ref={inputRef}
          name="code"
          autoFocus
          autoComplete="off"
          placeholder={t("scanPlaceholder")}
          className="h-11 flex-1 rounded-lg border border-line bg-surface px-3 font-mono text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
        <Button type="submit" disabled={pending}>
          {t("scanBtn")}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setCamErr(null);
            setCamOn((v) => !v);
          }}
          title={t("camera")}
        >
          {icons.camera("h-5 w-5")}
        </Button>
      </form>

      {camErr && <p className="mt-2 text-xs text-red-600">{camErr}</p>}

      {/* oxirgi natija */}
      {shown && (
        <div
          className={
            "mt-3 flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium " +
            (OUTCOME_STYLE[shown.outcome]?.cls ?? "")
          }
        >
          <span className="font-mono text-xs">{shown.code}</span>
          <span>— {t(("scan_" + shown.outcome) as "scan_loaded")}</span>
          {shown.label && <span className="ml-auto text-xs opacity-80">{shown.label}</span>}
          {shown.outcome === "can_add" && shown.cargoId && (
            <Button
              type="button"
              size="sm"
              onClick={() => handleAddToPlan(shown)}
              disabled={adding}
              className="ml-auto"
            >
              {adding ? "…" : t("addToPlan")}
            </Button>
          )}
        </div>
      )}

      <p className="mt-2 text-xs text-muted">{t("scanHint")}</p>
    </Card>
  );
}
