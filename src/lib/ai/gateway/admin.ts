import { NextResponse } from 'next/server';

/**
 * Guard for operator-only routes. In production these need the ADMIN_SECRET header;
 * if ADMIN_SECRET is unset they are simply off. In development they stay open.
 * Returns a response to send back, or null when the caller may proceed.
 */
export function adminGuard(req: Request): NextResponse | null {
  if (process.env.NODE_ENV !== 'production') return null;
  const secret = process.env.ADMIN_SECRET;
  if (secret && req.headers.get('x-admin-secret') === secret) return null;
  return new NextResponse('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
}
