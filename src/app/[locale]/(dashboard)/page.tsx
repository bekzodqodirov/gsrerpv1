import { getTranslations } from "next-intl/server";
import { getSession } from "@/modules/shared/auth";

export default async function DashboardPage() {
  const t = await getTranslations("home");
  const session = await getSession();

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">
        {t("welcome", { name: session?.fullName ?? "" })}
      </h1>
      <p className="mt-2 text-gray-500">{t("subtitle")}</p>
    </main>
  );
}
