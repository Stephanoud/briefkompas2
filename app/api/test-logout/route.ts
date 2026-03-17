import { NextResponse } from "next/server";
import { TEST_AUTH_COOKIE_NAME, testAuthCookieOptions } from "@/lib/testAuth";

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.set(TEST_AUTH_COOKIE_NAME, "", {
    ...testAuthCookieOptions,
    maxAge: 0,
  });
  return response;
}
