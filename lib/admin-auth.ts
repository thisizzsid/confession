import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "confession_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;

const getSecret = () => process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || "";

const sign = (value: string) => createHmac("sha256", getSecret()).update(value).digest("hex");

export const adminCookieName = COOKIE_NAME;

export function isAdminPasswordValid(password: unknown) {
  const expected = process.env.ADMIN_PASSWORD;
  if (typeof password !== "string" || !expected || password.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(password), Buffer.from(expected));
}

export function createAdminSession() {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = String(expiresAt);
  return `${payload}.${sign(payload)}`;
}

export function isAdminSessionValid(value?: string) {
  if (!value) return false;
  const [expiresAt, signature] = value.split(".");
  if (!expiresAt || !signature || Number(expiresAt) < Math.floor(Date.now() / 1000) || !getSecret()) return false;
  const expected = sign(expiresAt);
  if (signature.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export const adminSessionOptions = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};
