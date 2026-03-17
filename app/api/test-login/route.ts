import { NextResponse } from "next/server";
import {
  isValidTestLogin,
  normalizeNextPath,
  resolveAuthenticatedPath,
  TEST_AUTH_COOKIE_NAME,
  TEST_AUTH_COOKIE_VALUE,
  testAuthCookieOptions,
} from "@/lib/testAuth";

export async function POST(request: Request) {
  const formData = await request.formData();
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const nextPath = normalizeNextPath(formData.get("next"));

  if (!isValidTestLogin(username, password)) {
    const errorUrl = new URL("/login", request.url);
    errorUrl.searchParams.set("error", "1");
    errorUrl.searchParams.set("next", nextPath);
    return NextResponse.redirect(errorUrl, 303);
  }

  const response = NextResponse.redirect(
    new URL(resolveAuthenticatedPath(nextPath), request.url),
    303,
  );
  response.cookies.set(TEST_AUTH_COOKIE_NAME, TEST_AUTH_COOKIE_VALUE, testAuthCookieOptions);
  return response;
}
