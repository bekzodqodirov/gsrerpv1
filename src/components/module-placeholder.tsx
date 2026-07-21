import { getTranslations } from "next-intl/server";

export async function ModulePlaceholder({
  navKey,
}: {
  navKey: "cargo" | "clients" | "finance" | "hr" | "settings";
}) {
  const nav = await getTranslations("nav");
  const t = await getTranslations("common");

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">{nav(navKey)}</h1>
      <p className="mt-2 text-gray-500">{t("comingSoon")}</p>
    </main>
  );
}
