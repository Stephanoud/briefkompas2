import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

export const TEST_AUTH_COOKIE_NAME = "briefkompas_test_auth";
export const TEST_AUTH_COOKIE_VALUE = "briefkompas_test_mode";
export const TEST_AUTH_USERNAME = "briefkompas";
export const TEST_AUTH_PASSWORD = "briefkompas";

export const testAuthCookieOptions: Partial<ResponseCookie> = {
  httpOnly: true,
  maxAge: 60 * 60 * 12,
  path: "/",
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
};

export function hasValidTestAuthCookie(value: string | undefined) {
  return value === TEST_AUTH_COOKIE_VALUE;
}

export function isValidTestLogin(username: string, password: string) {
  return username === TEST_AUTH_USERNAME && password === TEST_AUTH_PASSWORD;
}

export function normalizeNextPath(value: FormDataEntryValue | string | null | undefined) {
  const path = typeof value === "string" ? value : "/";

  if (!path.startsWith("/") || path.startsWith("//")) {
    return "/";
  }

  if (path === "/login" || path.startsWith("/login?")) {
    return "/";
  }

  return path;
}
