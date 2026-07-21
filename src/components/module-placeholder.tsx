import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui";

export async function ModulePlaceholder({
  navKey,
}: {
  navKey: "cargo" | "clients" | "finance" | "hr" | "settings";
}) {
  const nav = await getTranslations("nav");
  const t = await getTranslations("common");

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
        {nav(navKey)}
      </h1>
      <Card className="flex flex-col items-center justify-center gap-2 p-12 text-center">
        <span className="text-3xl">🚧</span>
        <p className="text-sm text-muted">{t("comingSoon")}</p>
      </Card>
    </div>
  );
}
