/**
 * GET /api/admin/auth-check
 * Validates the admin_token cookie and returns authentication status.
 * Used by the admin panel on mount to restore sessions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/admin-auth';

export async function GET(request: NextRequest) {
  const admin = await getAdminFromRequest(request);

  if (!admin) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    username: admin.username,
  });
}
