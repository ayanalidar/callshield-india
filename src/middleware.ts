/**
 * CallShield Middleware
 * Protects /admin and /history behind auth.
 * Stores session in cookie for SSR.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that require authentication
const PROTECTED_ROUTES = ['/admin', '/history'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only guard the exact protected paths (not sub-paths like /admin/api)
  const isProtected = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  // Check for auth status via cookie
  const hasAuthCookie = request.cookies.get('sb-access-token')?.value;

  if (!hasAuthCookie) {
    // Also check the Supabase auth cookie pattern
    const allCookies = request.cookies.getAll();
    const sbCookie = allCookies.find(
      (c) => c.name.startsWith('sb-') && c.name.endsWith('-auth-token')
    );

    if (!sbCookie) {
      const loginUrl = new URL('/auth/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/history/:path*'],
};
