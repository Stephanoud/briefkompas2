import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { hasValidTestAuthCookie, normalizeNextPath, TEST_AUTH_COOKIE_NAME } from "@/lib/testAuth";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  const isLoginPage = pathname === "/login";
  const isAuthenticated = hasValidTestAuthCookie(request.cookies.get(TEST_AUTH_COOKIE_NAME)?.value);

  if (isAuthenticated) {
    if (!isLoginPage) {
      return NextResponse.next();
    }

    const redirectUrl = new URL(normalizeNextPath(request.nextUrl.searchParams.get("next")), request.url);
    return NextResponse.redirect(redirectUrl);
  }

  if (isLoginPage) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", normalizeNextPath(`${pathname}${search}`));

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
