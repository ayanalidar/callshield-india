/**
 * User Block List API
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getUserBlocks, blockNumber, unblockNumber } from '@/db/supabase';

export async function GET(request: NextRequest) {
  const { userId, error } = await requireAuth(request);
  if (error) return error;

  try {
    const blocks = await getUserBlocks(userId);
    return NextResponse.json(blocks);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { userId, error } = await requireAuth(request);
  if (error) return error;

  try {
    const body = await request.json();
    const { phoneNumber, reason, scamType } = body;
    const ok = await blockNumber(userId, phoneNumber, reason, scamType);
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
    const ok = await unblockNumber(userId, id);
    return NextResponse.json({ success: ok });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
