/**
 * User Whitelist API
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getWhitelist, addToWhitelist, removeFromWhitelist } from '@/db/supabase';

export async function GET(request: NextRequest) {
  const { userId, error } = await requireAuth(request);
  if (error) return error;

  try {
    const list = await getWhitelist(userId);
    return NextResponse.json(list);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { userId, error } = await requireAuth(request);
  if (error) return error;

  try {
    const body = await request.json();
    const { phoneNumber, contactName } = body;
    const ok = await addToWhitelist(userId, phoneNumber, contactName);
    return NextResponse.json({ success: ok });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { userId, error } = await requireAuth(request);
  if (error) return error;

  try {
    const { id } = await request.json();
    const ok = await removeFromWhitelist(userId, id);
    return NextResponse.json({ success: ok });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
