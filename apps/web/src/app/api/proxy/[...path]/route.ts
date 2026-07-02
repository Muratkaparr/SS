import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ACCESS_COOKIE } from '@/lib/cookies';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';

async function handle(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const jar = await cookies();
  const accessToken = jar.get(ACCESS_COOKIE)?.value;

  const search = req.nextUrl.search;
  const url = `${API_URL}/api/${path.join('/')}${search}`;

  const hasBody = !['GET', 'HEAD', 'DELETE'].includes(req.method);

  const res = await fetch(url, {
    method: req.method,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: hasBody ? await req.text() : undefined,
    cache: 'no-store',
  });

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
  });
}

export {
  handle as GET,
  handle as POST,
  handle as PATCH,
  handle as DELETE,
  handle as PUT,
};
