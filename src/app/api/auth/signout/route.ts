/**
 * POST /api/auth/signout — Sign out the current user
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(_request: NextRequest) {
  const response = NextResponse.json({ success: true });

  // Clear auth cookies
  response.cookies.set('sb-access-token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });

  // The Supabase cookie name varies by project; clear all sb- cookies
  // We'll clear the most common pattern
  response.cookies.set('sb-auth-token', '', { maxAge: 0, path: '/' });

  return response;
}
