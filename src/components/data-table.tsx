"use client";

// Loyiha bo'yicha umumiy, sozlanadigan jadval:
//  • ustunlarni yashirish/ko'rsatish (localStorage'da eslab qoladi)
//  • ustun bo'yicha filtr (matn yoki ro'yxat) + umumiy qidiruv
//  • mobil: har qator KARTA ko'rinishida (gorizontal scroll emas)
//  • ixtiyoriy kengaytiriladigan qator (master-detail)
import {
  Fragment,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "@/i18n/routing";
import { icons } from "@/components/icons";

export type Column<T> = {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Filtr/qidiruv uchun matn qiymati (bo'lmasa bu ustun filtrlanmaydi). */
  value?: (row: T) => string;
  /** Ustun bo'yicha filtr turi. "select" — value'lardan avtomatik ro'yxat. */
  filter?: "text" | "select";
  align?: "left" | "right" | "center";
  /** Yashirib bo'lmaydigan ustun (masalan asosiy identifikator). */
  locked?: boolean;
  defaultHidden?: boolean;
  className?: string;
};

export type DataTableLabels = {
  search: string;
  columns: string;
  filters: string;
  reset: string;
  noMatch: string;
  all: string;
  empty: string;
};

const alignCls = (a?: string) =>
  a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";

export function DataTable<T>({
  tableId,
  columns,
  rows,
  getRowKey,
  labels: L,
  renderExpanded,
  rowHref,
  initialShowFilters = false,
}: {
  tableId: string;
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  labels: DataTableLabels;
  renderExpanded?: (row: T) => ReactNode;
  /** Berilsa — butun qator/karta shu manzilga link bo'ladi (chevron kengaytiradi). */
  rowHref?: (row: T) => string;
  initialShowFilters?: boolean;
}) {
  const router = useRouter();
  // ── Ko'rinadigan ustunlar (localStorage) ──
  const storageKey = `dt:${tableId}:cols`;
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);
  // localStorage'dan tiklash faqat mount'dan keyin bo'ladi (SSR-xavfsiz) —
  // bu from-storage sinxronizatsiya, shu sabab qoida bu yerda o'chirilgan.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let next: Set<string>;
    try {
      const raw = localStorage.getItem(storageKey);
      next = raw
        ? new Set(JSON.parse(raw) as string[])
        : new Set(columns.filter((c) => c.defaultHidden).map((c) => c.id));
    } catch {
      next = new Set(columns.filter((c) => c.defaultHidden).map((c) => c.id));
    }
    setHidden(next);
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem(storageKey, JSON.stringify([...hidden]));
      } catch {
        /* ignore */
      }
  }, [hidden, ready, storageKey]);

  const visibleCols = columns.filter((c) => !hidden.has(c.id));

  // ── Qidiruv + filtrlar ──
  const [query, setQuery] = useState("");
  const [colFilters, setColFilters] = useState<Record<string, string>>({});
  const [showCols, setShowCols] = useState(false);
  const [showFilters, setShowFilters] = useState(initialShowFilters);
  const [expanded, setExpanded] = useState<string | null>(null);

  const filterableCols = columns.filter((c) => c.value && c.filter);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (q) {
        const hay = columns
          .filter((c) => c.value)
          .map((c) => c.value!(row).toLowerCase())
          .join(" ");
        if (!hay.includes(q)) return false;
      }
      for (const c of filterableCols) {
        const fv = colFilters[c.id];
        if (!fv) continue;
        const v = c.value!(row).toLowerCase();
        if (c.filter === "select" ? v !== fv.toLowerCase() : !v.includes(fv.toLowerCase()))
          return false;
      }
      return true;
    });
  }, [rows, query, colFilters, columns, filterableCols]);

  const activeFilterCount =
    Object.values(colFilters).filter(Boolean).length + (query ? 1 : 0);

  function resetAll() {
    setQuery("");
    setColFilters({});
  }

  const colCount = visibleCols.length + (renderExpanded ? 1 : 0);

  return (
    <div className="space-y-3">
      {/* Asboblar paneli */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={L.search}
            className="h-9 w-full rounded-lg border border-line bg-surface pr-3 pl-8 text-sm outline-none focus:border-primary"
          />
          <span className="pointer-events-none absolute top-2.5 left-2.5 text-muted">
            {icons.search("h-4 w-4")}
          </span>
        </div>

        {filterableCols.length > 0 && (
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={
              "touch-manipulation inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors " +
              (showFilters || activeFilterCount
                ? "border-primary/50 bg-primary-soft text-primary"
                : "border-line hover:bg-surface-2")
            }
          >
            {icons.search("h-4 w-4")}
            {L.filters}
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        )}

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowCols((v) => !v)}
            className="touch-manipulation inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-medium hover:bg-surface-2"
          >
            {icons.settings("h-4 w-4")}
            <span className="hidden sm:inline">{L.columns}</span>
          </button>
          {showCols && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={() => setShowCols(false)}
              />
              <div className="absolute right-0 z-30 mt-1 max-h-72 w-52 overflow-y-auto rounded-lg border border-line bg-surface p-1.5 shadow-lg">
                {columns.map((c) => {
                  const on = !hidden.has(c.id);
                  return (
                    <label
                      key={c.id}
                      className={
                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm " +
                        (c.locked
                          ? "text-muted"
                          : "cursor-pointer hover:bg-surface-2")
                      }
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={c.locked}
                        onChange={() =>
                          setHidden((prev) => {
                            const n = new Set(prev);
                            if (n.has(c.id)) n.delete(c.id);
                            else n.add(c.id);
                            return n;
                          })
                        }
                        className="h-4 w-4 accent-[var(--primary)]"
                      />
                      {c.header}
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={resetAll}
            className="touch-manipulation inline-flex h-9 items-center rounded-lg px-2.5 text-sm font-medium text-muted hover:text-foreground"
          >
            {L.reset}
          </button>
        )}
      </div>

      {/* Filtr paneli */}
      {showFilters && filterableCols.length > 0 && (
        <div className="grid gap-2 rounded-lg border border-line bg-surface-2/40 p-3 sm:grid-cols-2 lg:grid-cols-3">
          {filterableCols.map((c) => {
            const opts =
              c.filter === "select"
                ? [...new Set(rows.map((r) => c.value!(r)).filter(Boolean))].sort()
                : [];
            return (
              <label key={c.id} className="text-xs">
                <span className="mb-1 block text-muted">{c.header}</span>
                {c.filter === "select" ? (
                  <select
                    value={colFilters[c.id] ?? ""}
                    onChange={(e) =>
                      setColFilters((f) => ({ ...f, [c.id]: e.target.value }))
                    }
                    className="h-9 w-full rounded-lg border border-line bg-surface px-2 text-sm outline-none focus:border-primary"
                  >
                    <option value="">{L.all}</option>
                    {opts.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={colFilters[c.id] ?? ""}
                    onChange={(e) =>
                      setColFilters((f) => ({ ...f, [c.id]: e.target.value }))
                    }
                    className="h-9 w-full rounded-lg border border-line bg-surface px-2 text-sm outline-none focus:border-primary"
                  />
                )}
              </label>
            );
          })}
        </div>
      )}

      {/* ── Desktop: jadval ── */}
      <div className="hidden overflow-x-auto rounded-xl border border-line sm:block">
        <table className="w-full text-sm">
          <thead className="bg-surface-2/60">
            <tr>
              {renderExpanded && <th className="w-8" />}
              {visibleCols.map((c) => (
                <th
                  key={c.id}
                  className={
                    "px-3 py-2.5 font-semibold whitespace-nowrap " + alignCls(c.align)
                  }
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-3 py-10 text-center text-muted">
                  {rows.length === 0 ? L.empty : L.noMatch}
                </td>
              </tr>
            ) : (
              filtered.map((row) => {
                const key = getRowKey(row);
                const isOpen = expanded === key;
                const clickable = Boolean(rowHref || renderExpanded);
                return (
                  <Fragment key={key}>
                    <tr
                      className={
                        "border-t border-line/60 " +
                        (clickable ? "cursor-pointer hover:bg-surface-2/40" : "")
                      }
                      onClick={
                        rowHref
                          ? () => router.push(rowHref(row))
                          : renderExpanded
                            ? () => setExpanded(isOpen ? null : key)
                            : undefined
                      }
                    >
                      {renderExpanded && (
                        <td className="pl-3">
                          <button
                            type="button"
                            aria-label="expand"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpanded(isOpen ? null : key);
                            }}
                            className="touch-manipulation flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-surface-2"
                          >
                            <svg
                              viewBox="0 0 16 16"
                              className={
                                "h-4 w-4 transition-transform " +
                                (isOpen ? "rotate-90" : "")
                              }
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M6 4l4 4-4 4" />
                            </svg>
                          </button>
                        </td>
                      )}
                      {visibleCols.map((c) => (
                        <td
                          key={c.id}
                          className={"px-3 py-2 " + alignCls(c.align) + " " + (c.className ?? "")}
                        >
                          {c.cell(row)}
                        </td>
                      ))}
                    </tr>
                    {isOpen && renderExpanded && (
                      <tr className="bg-surface-2/30">
                        <td colSpan={colCount} className="p-0">
                          {renderExpanded(row)}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Mobil: kartalar ── */}
      <div className="space-y-2 sm:hidden">
        {filtered.length === 0 ? (
          <p className="rounded-xl border border-line py-8 text-center text-sm text-muted">
            {rows.length === 0 ? L.empty : L.noMatch}
          </p>
        ) : (
          filtered.map((row) => {
            const key = getRowKey(row);
            const isOpen = expanded === key;
            return (
              <div
                key={key}
                className="rounded-xl border border-line bg-surface p-3"
              >
                <div className="flex items-start gap-2">
                  <div
                    className={"min-w-0 flex-1 " + (rowHref ? "cursor-pointer" : renderExpanded ? "cursor-pointer" : "")}
                    onClick={
                      rowHref
                        ? () => router.push(rowHref(row))
                        : renderExpanded
                          ? () => setExpanded(isOpen ? null : key)
                          : undefined
                    }
                  >
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                      {visibleCols.map((c) => (
                        <div key={c.id} className="contents">
                          <dt className="text-xs text-muted">{c.header}</dt>
                          <dd className={"text-sm " + alignCls("left")}>
                            {c.cell(row)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                  {renderExpanded && (
                    <button
                      type="button"
                      aria-label="expand"
                      onClick={() => setExpanded(isOpen ? null : key)}
                      className="touch-manipulation flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted hover:bg-surface-2"
                    >
                      <svg
                        viewBox="0 0 16 16"
                        className={
                          "h-4 w-4 transition-transform " + (isOpen ? "rotate-90" : "")
                        }
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M6 4l4 4-4 4" />
                      </svg>
                    </button>
                  )}
                </div>
                {isOpen && renderExpanded && (
                  <div className="mt-2 border-t border-line pt-2">
                    {renderExpanded(row)}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
