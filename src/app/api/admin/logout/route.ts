/**
 * POST /api/admin/logout
 * Clears the admin_token cookie to log the admin out.
 */

import { NextRequest, NextResponse } from 'next/server';
import { TOKEN_COOKIE } from '@/lib/admin-auth';

export async function POST(_request: NextRequest) {
  const response = NextResponse.json({ success: true });
  response.cookies.set(TOKEN_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
