import { getLocale, getTranslations } from "next-intl/server";
import { getSession } from "@/modules/shared/auth";
import { getDashboard } from "@/modules/dashboard/service";
import { Link } from "@/i18n/routing";
import { batchStatusColors } from "@/components/batch-status";
import { Card, StatCard, Badge } from "@/components/ui";
import { icons, type IconName } from "@/components/icons";

const SHORTCUTS: { key: string; href: string; icon: IconName }[] = [
  { key: "cargo", href: "/cargo", icon: "cargo" },
  { key: "stock", href: "/stock", icon: "stock" },
  { key: "tms", href: "/tms", icon: "truck" },
  { key: "finance", href: "/finance", icon: "finance" },
  { key: "clients", href: "/clients", icon: "clients" },
];

export default async function DashboardPage() {
  const locale = await getLocale();
  const t = await getTranslations("home");
  const nav = await getTranslations("nav");
  const ts = await getTranslations("batchStatus");
  const session = await getSession();
  const d = await getDashboard();

  const num = (v: number, dig = 0) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: dig }).format(v);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          {t("welcome", { name: session?.fullName ?? "" })}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {d.warehouseName ? d.warehouseName : t("subtitle")}
        </p>
      </div>

      {/* ─── Asosiy KPI ─── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard value={`${num(d.stock.m3, 2)} m³`} label={t("stockVol")} />
        <StatCard value={`${num(d.stock.kg)} kg`} label={t("stockWeight")} />
        <StatCard value={`${num(d.transit.m3, 2)} m³`} label={t("inTransit")} />
        <StatCard value={num(d.intake.count)} label={t("intakeWeek")} />
      </div>

      {/* ─── Moliya KPI (buxgalter/admin) ─── */}
      {d.finance && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard value={`${num(d.finance.revenueUsd)} $`} label={t("revenueMonth")} />
          <StatCard value={`${num(d.finance.expenseUsd)} $`} label={t("expenseMonth")} />
          <StatCard
            value={
              <span className={d.finance.marginUsd >= 0 ? "text-emerald-600" : "text-red-600"}>
                {num(d.finance.marginUsd)} $
              </span>
            }
            label={t("marginMonth")}
          />
          <StatCard value={`${num(d.finance.debtorsUsd)} $`} label={`${t("debtors")} · ${d.finance.debtorCount}`} />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ─── Ombor qoldig'i ─── */}
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t("perWarehouse")}</h2>
            <Link href="/stock" className="text-xs text-primary hover:underline">
              {t("all")} →
            </Link>
          </div>
          {d.stock.warehouses.length === 0 ? (
            <p className="text-sm text-muted">{t("noStock")}</p>
          ) : (
            <div className="space-y-2">
              {d.stock.warehouses.map((w) => (
                <div key={w.gsCode} className="flex items-center justify-between rounded-lg bg-surface-2/50 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold">{w.gsCode}</span>
                    <span className="text-sm">{w.name}</span>
                  </div>
                  <div className="flex gap-3 font-mono text-xs text-muted tabular-nums">
                    <span>{num(w.m3, 2)} m³</span>
                    <span>{num(w.kg)} kg</span>
                    <span>{num(w.boxes)} {t("boxes")}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ─── So'nggi partiyalar ─── */}
        {d.recentBatches && (
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">{t("recentBatches")}</h2>
              <Link href="/tms" className="text-xs text-primary hover:underline">
                {t("all")} →
              </Link>
            </div>
            {d.recentBatches.length === 0 ? (
              <p className="text-sm text-muted">{t("noBatches")}</p>
            ) : (
              <div className="space-y-2">
                {d.recentBatches.map((b) => (
                  <Link
                    key={b.id}
                    href={`/tms/${b.id}`}
                    className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-surface-2/60"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold">{b.code}</span>
                      <span className="font-mono text-xs text-muted">
                        {b.originGs} → {b.destGs}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted">{b.cargoCount}</span>
                      <Badge className={batchStatusColors[b.status] ?? ""}>
                        {ts(b.status as "planned")}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* ─── Eng ko'p qoldiqli mijozlar ─── */}
        {d.topClients.length > 0 && (
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold">{t("topClients")}</h2>
            <div className="space-y-2">
              {d.topClients.map((c) => (
                <div key={c.code} className="flex items-center justify-between rounded-lg bg-surface-2/50 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold">{c.code}</span>
                    <span className="text-sm">{c.name}</span>
                  </div>
                  <span className="font-mono text-xs tabular-nums text-muted">
                    {num(c.m3, 2)} m³
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ─── Tez havolalar ─── */}
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">{t("quickLinks")}</h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {SHORTCUTS.map((s) => (
              <Link key={s.key} href={s.href} className="group flex flex-col items-center gap-1.5 rounded-lg p-2 hover:bg-surface-2/60">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  {icons[s.icon]("h-5 w-5")}
                </span>
                <span className="text-[11px] font-medium">{nav(s.key)}</span>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
