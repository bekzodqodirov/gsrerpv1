"use client";

// Ilova qobig'i: desktopda doimiy sidebar, mobilda hamburger + slayd-menyu.
import { useState, useEffect } from "react";
import { Link, usePathname } from "@/i18n/routing";
import { useLocale } from "next-intl";
import { locales, localeNames, type Locale } from "@/i18n/config";
import { icons, type IconName } from "./icons";
import { cn } from "./ui";

export type NavItem = { key: string; href: string; label: string; icon: IconName };

export function AppShell({
  appName,
  navItems,
  userName,
  logoutLabel,
  logoutAction,
  children,
}: {
  appName: string;
  navItems: NavItem[];
  userName: string;
  logoutLabel: string;
  logoutAction: () => Promise<void>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const locale = useLocale();
  const [open, setOpen] = useState(false);

  // Sahifa almashganda (tashqi navigatsiya hodisasi) mobil menyuni yopamiz.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const nav = (
    <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
      {navItems.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
            isActive(item.href)
              ? "bg-primary-soft text-primary"
              : "text-muted hover:bg-surface-2 hover:text-foreground",
          )}
        >
          {icons[item.icon]("h-5 w-5 shrink-0")}
          {item.label}
        </Link>
      ))}
    </nav>
  );

  const footer = (
    <div className="border-t border-line p-3">
      <div className="flex flex-wrap gap-x-2 gap-y-1 px-2 pb-2.5">
        {locales.map((l: Locale) => (
          <Link
            key={l}
            href={pathname}
            locale={l}
            className={cn(
              "text-[11px] transition-colors",
              l === locale
                ? "font-bold text-primary"
                : "text-muted hover:text-foreground",
            )}
          >
            {localeNames[l]}
          </Link>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{userName}</div>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            title={logoutLabel}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface hover:text-red-500"
          >
            {icons.logout("h-4.5 w-4.5")}
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-surface lg:flex print:hidden">
        <div className="flex h-14 items-center gap-2 border-b border-line px-5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-xs font-black text-white">
            G
          </span>
          <span className="text-[15px] font-bold tracking-tight">{appName}</span>
        </div>
        {nav}
        {footer}
      </aside>

      {/* Mobil topbar */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface px-4 lg:hidden print:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          // touch-manipulation: mobil brauzerlar (ayniqsa Chrome/Android) sahifa
          // TEPASIDAGI elementlarda tortib-yangilash (pull-to-refresh) yoki
          // qo'sh-teginish kattalashtirishni aniqlash uchun tegishni biroz
          // KECHIKTIRISHI/yutib yuborishi mumkin — shu sabab bosh menyu tugmasi
          // ba'zan javob bermaydi. Bu klass brauzerga darrov "oddiy tap" deb
          // hisoblashni buyuradi.
          className="flex h-9 w-9 touch-manipulation items-center justify-center rounded-lg text-muted hover:bg-surface-2"
          aria-label="Menu"
        >
          {icons.menu()}
        </button>
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-[10px] font-black text-white">
          G
        </span>
        <span className="text-sm font-bold">{appName}</span>
      </header>

      {/* Mobil slayd-menyu */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal>
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-surface shadow-xl">
            <div className="flex h-14 items-center justify-between border-b border-line px-4">
              <span className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-xs font-black text-white">
                  G
                </span>
                <span className="font-bold">{appName}</span>
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 touch-manipulation items-center justify-center rounded-lg text-muted hover:bg-surface-2"
                aria-label="Close"
              >
                {icons.close()}
              </button>
            </div>
            {nav}
            {footer}
          </div>
        </div>
      )}

      {/* Kontent */}
      <div className="min-w-0 flex-1 lg:pl-60 print:pl-0">
        <main className="mx-auto w-full max-w-6xl p-4 sm:p-6 lg:p-8 print:max-w-none print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}
