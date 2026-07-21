import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Card, PageHeader } from "@/components/ui";
import { icons } from "@/components/icons";

type Section = { href: string; key: string; icon: keyof typeof icons };

// Bosqichma-bosqich to'ldiriladi (invoys/to'lov/xarajat/foyda keyingi commitda).
const SECTIONS: Section[] = [
  { href: "/finance/tariffs", key: "tariffs", icon: "finance" },
  { href: "/finance/rates", key: "rates", icon: "settings" },
];

export default async function FinancePage() {
  const t = await getTranslations("finance");
  const nav = await getTranslations("nav");

  return (
    <div className="space-y-4">
      <PageHeader title={nav("finance")} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((s) => (
          <Link key={s.key} href={s.href} className="group">
            <Card className="flex items-start gap-4 p-5 transition-all group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:shadow-md">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                {icons[s.icon]("h-5 w-5")}
              </span>
              <span>
                <span className="block font-semibold">{t(s.key)}</span>
                <span className="mt-0.5 block text-sm text-muted">
                  {t(`${s.key}Desc`)}
                </span>
              </span>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
