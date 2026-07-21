import { getTranslations } from "next-intl/server";
import { getSession } from "@/modules/shared/auth";
import { Link } from "@/i18n/routing";
import { Card } from "@/components/ui";
import { icons, type IconName } from "@/components/icons";

const SHORTCUTS: { key: string; href: string; icon: IconName }[] = [
  { key: "cargo", href: "/cargo", icon: "cargo" },
  { key: "clients", href: "/clients", icon: "clients" },
  { key: "finance", href: "/finance", icon: "finance" },
  { key: "hr", href: "/hr", icon: "hr" },
  { key: "settings", href: "/settings", icon: "settings" },
];

export default async function DashboardPage() {
  const t = await getTranslations("home");
  const nav = await getTranslations("nav");
  const session = await getSession();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          {t("welcome", { name: session?.fullName ?? "" })}
        </h1>
        <p className="mt-1 text-sm text-muted">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {SHORTCUTS.map((s) => (
          <Link key={s.key} href={s.href} className="group">
            <Card className="flex flex-col items-start gap-3 p-4 transition-all group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:shadow-md">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
                {icons[s.icon]("h-5 w-5")}
              </span>
              <span className="text-sm font-semibold">{nav(s.key)}</span>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
