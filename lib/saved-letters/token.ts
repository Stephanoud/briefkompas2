import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function generateRecoveryToken() {
  return randomBytes(32).toString("base64url");
}

export function hashRecoveryToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function hashesMatch(leftHex: string, rightHex: string) {
  const left = Buffer.from(leftHex, "hex");
  const right = Buffer.from(rightHex, "hex");

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}
