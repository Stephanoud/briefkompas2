export const DELIVERY_EMAIL_SESSION_KEY = "briefkompas_delivery_email";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

export function normalizeDeliveryEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidDeliveryEmail(value: string): boolean {
  return EMAIL_PATTERN.test(normalizeDeliveryEmail(value));
}

export function readStoredDeliveryEmail(): string {
  if (typeof window === "undefined") {
    return "";
  }

  return sessionStorage.getItem(DELIVERY_EMAIL_SESSION_KEY) ?? "";
}

export function writeStoredDeliveryEmail(value: string) {
  if (typeof window === "undefined") {
    return;
  }

  sessionStorage.setItem(DELIVERY_EMAIL_SESSION_KEY, normalizeDeliveryEmail(value));
}
