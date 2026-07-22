"use client";

// Skladchi uchun TELEFONGA mo'ljallangan skaner ekrani: katta kamera oynasi,
// katta progress, katta tugmalar — boshqa hech narsa. Plan/manifest/statistika
// obzor va plan sahifalarida qoladi.
import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import jsQR from "jsqr";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui";
import { icons } from "@/components/icons";
import type { ScanResult } from "@/modules/tms/dto";
import {
  scanLoadAction,
  scanUnloadAction,
  addLineAndScanAction,
} from "../../actions";

type Mode = "load" | "unload";

const OUTCOME_STYLE: Record<string, { cls: string; good: boolean }> = {
  loaded: { cls: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100", good: true },
  unloaded: { cls: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100", good: true },
  duplicate: { cls: "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100", good: false },
  can_add: { cls: "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100", good: false },
  quota_full: { cls: "bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100", good: false },
  not_on_plan: { cls: "bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100", good: false },
  extra: { cls: "bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100", good: false },
  unknown: { cls: "bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100", good: false },
  wrong_status: { cls: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200", good: false },
  wrong_warehouse: { cls: "bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100", good: false },
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
  try {
    navigator.vibrate?.(good ? 80 : [80, 60, 160]);
  } catch {
    /* ixtiyoriy */
  }
}

// Kamera afzalligi telefonda eslab qolinadi (standart: YOQIQ).
const CAM_PREF_KEY = "gsr_scan_cam";

export function ScanScreen({
  batchId,
  mode,
  done,
  total,
  batchCode,
  routeLabel,
}: {
  batchId: string;
  mode: Mode;
  done: number;
  total: number;
  batchCode: string;
  routeLabel: string;
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
  const [override, setOverride] = useState<{
    base: ScanResult;
    result: ScanResult;
  } | null>(null);
  const [adding, setAdding] = useState(false);
  const [flash, setFlash] = useState<ScanResult | null>(null);
  const lastScan = useRef<{ code: string; at: number }>({ code: "", at: 0 });

  // Ekran ochilishi bilan kamerani avtomatik yoqamiz (skladchi telefonda) —
  // faqat foydalanuvchi oldin o'zi o'chirmagan bo'lsa.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (localStorage.getItem(CAM_PREF_KEY) !== "0") setCamOn(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  function toggleCam() {
    setCamErr(null);
    setCamOn((v) => {
      localStorage.setItem(CAM_PREF_KEY, v ? "0" : "1");
      return !v;
    });
  }

  // Har javobdan keyin ovoz + flash + inputni tozalab, fokusni qaytaramiz.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!state) return;
    beep(OUTCOME_STYLE[state.outcome]?.good ?? false);
    setFlash(state);
    if (inputRef.current) inputRef.current.value = "";
    inputRef.current?.focus();
  }, [state]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!flash) return;
    const tm = setTimeout(() => setFlash(null), 1200);
    return () => clearTimeout(tm);
  }, [flash]);

  async function handleAddToPlan(res: ScanResult) {
    if (!res.lineId || adding) return;
    setAdding(true);
    try {
      const r = await addLineAndScanAction(batchId, res.lineId, res.code);
      setOverride({ base: res, result: r });
      beep(OUTCOME_STYLE[r.outcome]?.good ?? false);
      setFlash(r);
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
        if (!navigator.mediaDevices?.getUserMedia) {
          setCamErr(t("cameraHttps"));
          setCamOn(false);
          return;
        }
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
    <div className="mx-auto flex max-w-lg flex-col gap-3">
      {/* Yopishqoq sarlavha: partiya + KATTA progress */}
      <div className="sticky top-0 z-10 -mx-1 rounded-b-xl bg-background/95 px-1 pt-1 pb-2 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/tms/${batchId}`}
            className="inline-flex touch-manipulation items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-muted hover:bg-surface-2 hover:text-foreground"
          >
            ← <span className="font-mono font-bold">{batchCode}</span>
          </Link>
          <span className="truncate text-xs text-muted">{routeLabel}</span>
          <span
            className={
              "font-mono text-2xl font-black tabular-nums " +
              (complete ? "text-emerald-600" : "text-foreground")
            }
          >
            {shownDone}/{shownTotal}
          </span>
        </div>
        <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-surface-2">
          <div
            className={
              "h-full rounded-full transition-all " +
              (complete ? "bg-emerald-500" : "bg-primary")
            }
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="text-center text-sm font-semibold text-muted">
        {mode === "load" ? t("scanLoad") : t("scanUnload")}
      </div>

      {/* Kamera — ekranning asosiy qismi */}
      {camOn && (
        <div className="overflow-hidden rounded-2xl border-2 border-primary/40 shadow-sm">
          <video
            ref={videoRef}
            className="max-h-[48vh] w-full object-cover"
            muted
            playsInline
          />
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />
      {camErr && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {camErr}
        </p>
      )}

      {/* Qo'lda kiritish / barcode-skaner + kamera tugmasi */}
      <form ref={formRef} action={formAction} className="flex gap-2">
        <input
          ref={inputRef}
          name="code"
          autoFocus
          autoComplete="off"
          placeholder={t("scanPlaceholder")}
          className="h-13 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 font-mono text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
        <Button type="submit" size="lg" disabled={pending}>
          {t("scanBtn")}
        </Button>
        <Button
          type="button"
          size="icon"
          variant={camOn ? "primary" : "outline"}
          onClick={toggleCam}
          title={t("camera")}
        >
          {icons.camera("h-6 w-6")}
        </Button>
      </form>

      {/* Oxirgi natija */}
      {shown && (
        <div
          className={
            "flex flex-wrap items-center gap-2 rounded-xl px-4 py-3 text-base font-semibold " +
            (OUTCOME_STYLE[shown.outcome]?.cls ?? "")
          }
        >
          <span className="font-mono text-xs">{shown.code}</span>
          <span>— {t(("scan_" + shown.outcome) as "scan_loaded")}</span>
          {shown.label && (
            <span className="ml-auto text-sm font-medium opacity-80">{shown.label}</span>
          )}
          {shown.outcome === "can_add" && shown.cargoId && (
            <Button
              type="button"
              size="lg"
              onClick={() => handleAddToPlan(shown)}
              disabled={adding}
              className="ml-auto w-full"
            >
              {adding ? "…" : t("addToPlan")}
            </Button>
          )}
        </div>
      )}

      <p className="text-center text-xs text-muted">{t("scanHint")}</p>

      {/* Katta natija flash'i — uzoqdan ko'rinadi (✓ yashil / ✗ qizil) */}
      {flash && (
        <div
          className={
            "pointer-events-none fixed inset-0 z-[90] flex flex-col items-center justify-center " +
            (OUTCOME_STYLE[flash.outcome]?.good ? "bg-emerald-600/85" : "bg-red-600/85")
          }
        >
          <span className="text-8xl font-black text-white">
            {OUTCOME_STYLE[flash.outcome]?.good ? "✓" : "✗"}
          </span>
          <span className="mt-2 px-6 text-center text-xl font-bold text-white">
            {t(("scan_" + flash.outcome) as "scan_loaded")}
          </span>
          {flash.label && (
            <span className="mt-1 px-6 text-center text-sm font-medium text-white/90">
              {flash.label}
            </span>
          )}
          <span className="mt-1 font-mono text-xs text-white/75">{flash.code}</span>
        </div>
      )}
    </div>
  );
}
