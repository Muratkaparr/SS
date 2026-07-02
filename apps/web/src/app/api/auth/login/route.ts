import { NextResponse } from 'next/server';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  accessCookieOptions,
  refreshCookieOptions,
} from '@/lib/cookies';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';

export async function POST(req: Request) {
  const body = await req.json();

  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Giriş başarısız' }));
    return NextResponse.json(error, { status: res.status });
  }

  const data = await res.json();
  const response = NextResponse.json({ user: data.user });
  response.cookies.set(ACCESS_COOKIE, data.accessToken, accessCookieOptions());
  response.cookies.set(REFRESH_COOKIE, data.refreshToken, refreshCookieOptions());
  return response;
}
