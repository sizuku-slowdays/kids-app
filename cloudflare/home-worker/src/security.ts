import { pbkdf2Sync, timingSafeEqual } from "node:crypto";

export const ITERATIONS = 600000;
export function randomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function digest(value: string) {
  const result = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(result), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export function passwordHash(
  password: string,
  salt: string,
  iterations = ITERATIONS,
) {
  return pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("hex");
}
export function equal(a: string, b: string) {
  const left = new TextEncoder().encode(a),
    right = new TextEncoder().encode(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function validPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= 10 && value.length <= 128;
}
