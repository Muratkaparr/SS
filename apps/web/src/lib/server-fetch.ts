import { cookies } from 'next/headers';
import { ACCESS_COOKIE } from './cookies';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function serverFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const jar = await cookies();
  const accessToken = jar.get(ACCESS_COOKIE)?.value;

  const res = await fetch(`${API_URL}/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.message ?? 'İstek başarısız oldu');
  }

  return res.json() as Promise<T>;
}
