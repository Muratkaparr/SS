import { NextRequest, NextResponse } from 'next/server';
import { decodeJwt } from 'jose';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  accessCookieOptions,
  refreshCookieOptions,
} from './lib/cookies';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';

const ROLE_HOME: Record<string, string> = {
  USER: '/panel',
  ADMIN: '/admin',
  PLATFORM_ADMIN: '/developer',
};

const ROLE_PREFIX: Record<string, string> = {
  '/panel': 'USER',
  '/admin': 'ADMIN',
  '/developer': 'PLATFORM_ADMIN',
};

function matchPrefix(pathname: string) {
  return Object.keys(ROLE_PREFIX).find(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isExpired(token: string) {
  try {
    const payload = decodeJwt(token);
    if (!payload.exp) return true;
    return payload.exp * 1000 < Date.now() + 5_000;
  } catch {
    return true;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  let accessToken = req.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  let refreshedCookies: { access: string; refresh: string } | null = null;

  if ((!accessToken || isExpired(accessToken)) && refreshToken) {
    try {
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        accessToken = data.accessToken;
        refreshedCookies = { access: data.accessToken, refresh: data.refreshToken };
      } else {
        accessToken = undefined;
      }
    } catch {
      accessToken = undefined;
    }
  }

  const role = accessToken ? decodeJwt(accessToken).role as string : null;
  const protectedPrefix = matchPrefix(pathname);

  let response: NextResponse;

  if (pathname === '/login') {
    response = role
      ? NextResponse.redirect(new URL(ROLE_HOME[role] ?? '/login', req.url))
      : NextResponse.next();
  } else if (pathname === '/') {
    response = NextResponse.redirect(
      new URL(role ? ROLE_HOME[role] ?? '/login' : '/login', req.url),
    );
  } else if (protectedPrefix) {
    if (!role) {
      response = NextResponse.redirect(new URL('/login', req.url));
    } else if (ROLE_PREFIX[protectedPrefix] !== role) {
      response = NextResponse.redirect(new URL(ROLE_HOME[role] ?? '/login', req.url));
    } else {
      response = NextResponse.next();
    }
  } else {
    response = NextResponse.next();
  }

  if (refreshedCookies) {
    response.cookies.set(ACCESS_COOKIE, refreshedCookies.access, accessCookieOptions());
    response.cookies.set(REFRESH_COOKIE, refreshedCookies.refresh, refreshCookieOptions());
  } else if (accessToken === undefined && refreshToken) {
    response.cookies.delete(ACCESS_COOKIE);
    response.cookies.delete(REFRESH_COOKIE);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth).*)'],
};
