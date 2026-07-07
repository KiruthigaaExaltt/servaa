import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pin, salt, 32).toString("hex")}`;
}
export function verifyPin(pin: string, encoded: string): boolean {
  const [salt, expected] = encoded.split(":");
  if (!salt || !expected) return false;
  const actual = scryptSync(pin, salt, 32);
  const target = Buffer.from(expected, "hex");
  return actual.length === target.length && timingSafeEqual(actual, target);
}
type Session = { userId: string; outletId: string; role: string; exp: number };
function secret() {
  if (!process.env.AUTH_SECRET) throw new Error("AUTH_SECRET must be set");
  return process.env.AUTH_SECRET;
}
export function signSession(data: Omit<Session, "exp">): string {
  const payload = Buffer.from(JSON.stringify({ ...data, exp: Date.now() + 43_200_000 })).toString("base64url");
  return `${payload}.${createHmac("sha256", secret()).update(payload).digest("base64url")}`;
}
export function readSession(token?: string): Session | undefined {
  if (!token) return undefined;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return undefined;
  const expected = createHmac("sha256", secret()).update(payload).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return undefined;
  const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Session;
  return value.exp > Date.now() ? value : undefined;
}
