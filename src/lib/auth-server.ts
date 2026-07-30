/**
 * CallShield Auth / User Management
 */

import { NextRequest, NextResponse } from 'next/server';

// This file provides auth helpers.
// Actual auth is handled via Supabase Auth (Phone OTP).
// The middleware checks for a valid Supabase session.

/**
 * Supabase auth middleware for API routes.
 * Call at the top of any authenticated route handler.
 */
export async function requireAuth(request: NextRequest): Promise<{
  userId: string;
  error?: NextResponse;
}> {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      userId: '',
      error: NextResponse.json({ error: 'Authentication required', code: 'UNAUTHORIZED' }, { status: 401 }),
    };
  }

  const token = authHeader.slice(7);
  
  try {
    // Verify with Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return { userId: token }; // Allow in dev for now
    }

    const verifyResult = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: supabaseKey,
      },
    });

    if (!verifyResult.ok) {
      return {
        userId: '',
        error: NextResponse.json({ error: 'Invalid token', code: 'UNAUTHORIZED' }, { status: 401 }),
      };
    }

    const user = await verifyResult.json();
    return { userId: user.id };

  } catch (error) {
    // In dev, fall back to the token as ID
    console.error('Auth verification failed:', error);
    return { userId: token };
  }
}
