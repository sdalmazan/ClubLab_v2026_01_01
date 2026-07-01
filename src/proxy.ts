import createMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

const PROTECTED_PATHS = [
  "/dashboard",
  "/players",
  "/training",
  "/performance",
  "/injuries",
  "/matches",
  "/academy",
  "/settings",
  "/admin",
];

const AUTH_PATHS = ["/login", "/register", "/forgot-password"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Strip locale prefix for path matching, ensuring a leading slash remains
  let pathnameWithoutLocale = pathname.replace(/^\/(es|en|pt|fr|it|de|nl)(?:\/|$)/, "/");
  if (pathnameWithoutLocale.endsWith("/") && pathnameWithoutLocale !== "/") {
    pathnameWithoutLocale = pathnameWithoutLocale.slice(0, -1);
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected = PROTECTED_PATHS.some((p) =>
    pathnameWithoutLocale.startsWith(p)
  );

  const isAuthRoute = AUTH_PATHS.some((p) =>
    pathnameWithoutLocale.startsWith(p)
  );

  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirectTo", pathnameWithoutLocale);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthRoute && user) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    return NextResponse.redirect(dashboardUrl);
  }

  // Bypass i18n routing for API endpoints
  if (pathname.startsWith("/api")) {
    return supabaseResponse;
  }

  // Apply i18n routing
  const response = intlMiddleware(request);

  // Copy Supabase cookies to next-intl response so session updates are persisted
  const supabaseCookies = supabaseResponse.headers.getSetCookie();
  if (supabaseCookies.length > 0) {
    supabaseCookies.forEach((cookie) => {
      response.headers.append("set-cookie", cookie);
    });
  }

  return response;
}

export const config = {
  matcher: [
    "/",
    "/(es|en|pt|fr|it|de|nl)/:path*",
    "/((?!api|_next|_vercel|.*\\..*).*)",
  ],
};

