import { NextResponse } from "next/server";
import {
  adminCookieName,
  adminSessionOptions,
  createAdminSession,
  isAdminSessionValid,
  isAdminPasswordValid,
} from "@/lib/admin-auth";

const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function getClientKey(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function POST(request: Request) {
  const key = getClientKey(request);
  const now = Date.now();
  const record = attempts.get(key);
  if (record && record.resetAt > now && record.count >= MAX_ATTEMPTS) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  try {
    const { password } = await request.json();
    if (!isAdminPasswordValid(password)) {
      const next = record && record.resetAt > now ? record : { count: 0, resetAt: now + WINDOW_MS };
      next.count += 1;
      attempts.set(key, next);
      return NextResponse.json({ error: "Invalid admin credentials" }, { status: 401 });
    }

    attempts.delete(key);
    const response = NextResponse.json({ authenticated: true });
    response.cookies.set(adminCookieName, createAdminSession(), adminSessionOptions);
    return response;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function GET(request: Request) {
  const session = request.headers.get("cookie")?.match(new RegExp(`${adminCookieName}=([^;]+)`))?.[1];
  return NextResponse.json({ authenticated: isAdminSessionValid(session), configured: Boolean(process.env.ADMIN_PASSWORD) });
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(adminCookieName, "", { ...adminSessionOptions, maxAge: 0 });
  return response;
}
