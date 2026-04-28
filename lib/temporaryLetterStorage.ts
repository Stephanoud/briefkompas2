import { randomBytes, randomUUID } from "node:crypto";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
const TEMPORARY_STORAGE_TTL_DAYS = 7;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function addDays(baseDate: Date, days: number) {
  return new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
}

export function createTemporaryLetterId() {
  return randomUUID();
}

export function createTemporaryLetterToken() {
  return randomBytes(24).toString("hex");
}

export function createTemporaryLetterExpiry(createdAt = new Date()) {
  return addDays(createdAt, TEMPORARY_STORAGE_TTL_DAYS).toISOString();
}

export function isValidTemporaryLetterId(value: string) {
  return UUID_PATTERN.test(value);
}

export async function cleanupExpiredLetters() {
  const supabaseAdmin = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { error } = await supabaseAdmin
    .schema("public")
    .from("saved_letters")
    .delete()
    .lte("expires_at", now);

  if (error) {
    throw new Error("Verlopen concepten konden niet worden opgeschoond.");
  }
}
