import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { verifySession, SESSION_COOKIE } from "@/modules/shared/session";
import { locales } from "./i18n/config";

const intl = createMiddleware(routing);

// Login talab qilinmaydigan yo'llar
const PUBLIC_PATHS = ["/login"];

function stripLocale(pathname: string): string {
  const re = new RegExp(`^/(${locales.join("|")})(?=/|$)`);
  return pathname.replace(re, "") || "/";
}

function localePrefix(pathname: string): string {
  const m = pathname.match(new RegExp(`^/(${locales.join("|")})(?=/|$)`));
  return m ? `/${m[1]}` : "";
}

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const path = stripLocale(pathname);
  const isPublic = PUBLIC_PATHS.some(
    (p) => path === p || path.startsWith(`${p}/`),
  );

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);

  if (!isPublic && !session) {
    const url = req.nextUrl.clone();
    url.pathname = `${localePrefix(pathname)}/login`;
    return NextResponse.redirect(url);
  }

  if (isPublic && session) {
    const url = req.nextUrl.clone();
    url.pathname = localePrefix(pathname) || "/";
    return NextResponse.redirect(url);
  }

  return intl(req);
}

export const config = {
  // Statik fayllar va API'dan tashqari barcha yo'llar
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
