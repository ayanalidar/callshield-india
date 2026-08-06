/**
 * CallShield Middleware
 * Protects /history behind Supabase auth.
 * Admin pages handle their own auth via admin_token cookie.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that require Supabase auth (NOT admin auth)
const SUPABASE_PROTECTED = ['/history'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Admin routes use their own cookie-based auth — skip Supabase check
  if (pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  // Check Supabase-protected routes
  const isProtected = SUPABASE_PROTECTED.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  // Check for Supabase auth cookie
  const allCookies = request.cookies.getAll();
  const sbCookie = allCookies.find(
    (c) => c.name.startsWith('sb-') && c.name.endsWith('-auth-token')
  );

  if (!sbCookie) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/history/:path*'],
};
