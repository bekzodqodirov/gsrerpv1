import { getTranslations } from "next-intl/server";
import { getSession } from "@/modules/shared/auth";
import { AppShell, type NavItem } from "@/components/app-shell";
import { logoutAction } from "./actions";

const NAV_ITEMS = [
  { key: "dashboard", href: "/", icon: "dashboard" },
  { key: "cargo", href: "/cargo", icon: "cargo" },
  { key: "stock", href: "/stock", icon: "stock" },
  { key: "tms", href: "/tms", icon: "truck" },
  { key: "clients", href: "/clients", icon: "clients" },
  { key: "finance", href: "/finance", icon: "finance" },
  { key: "hr", href: "/hr", icon: "hr" },
  { key: "settings", href: "/settings", icon: "settings" },
] as const;

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();
  const nav = await getTranslations("nav");
  const t = await getTranslations("common");

  const navItems: NavItem[] = NAV_ITEMS.map((i) => ({
    ...i,
    label: nav(i.key),
  }));

  return (
    <AppShell
      appName={t("appName")}
      navItems={navItems}
      userName={session?.fullName ?? ""}
      logoutLabel={nav("logout")}
      logoutAction={logoutAction}
    >
      {children}
    </AppShell>
  );
}
