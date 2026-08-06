/**
 * POST /api/admin/login
 * Authenticates an admin user with username + password.
 * Returns a signed JWT and sets it as an httpOnly cookie.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_USERNAME,
  ADMIN_PASSWORD,
  TOKEN_COOKIE,
  TOKEN_TTL_MS,
  createAdminToken,
} from '@/lib/admin-auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body || {};

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Username and password are required' },
        { status: 400 },
      );
    }

    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 },
      );
    }

    const token = await createAdminToken(username);

    const response = NextResponse.json({ success: true, token });
    response.cookies.set(TOKEN_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: TOKEN_TTL_MS / 1000,
    });

    return response;
  } catch (e: any) {
    console.error('[Admin Login] Error:', e);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
