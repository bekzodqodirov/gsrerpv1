// Sig'im to'ldirilishi chizig'i — obzor va plan sahifalarida birdek ishlatiladi.
export function FillBar({
  label,
  value,
  max,
  unit,
  num,
}: {
  label: string;
  value: number;
  max: number;
  unit: string;
  num: (n: number, d?: number) => string;
}) {
  const pct = Math.min(100, (value / max) * 100);
  const over = value > max;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span
          className={
            "font-mono tabular-nums " +
            (over ? "font-semibold text-red-600" : "text-foreground")
          }
        >
          {num(value, 1)} / {num(max, 1)} {unit} · {Math.round(pct)}%
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className={
            "h-full rounded-full " +
            (over ? "bg-red-500" : pct > 85 ? "bg-amber-500" : "bg-emerald-500")
          }
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
