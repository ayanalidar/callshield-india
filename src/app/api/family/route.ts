/**
 * CallShield Family Plan API
 * 
 * POST /api/family — Create plan (generate invite code) or join via code
 * GET /api/family  — Get family plan, members, and alerts for current user
 *
 * inviteCode → 6 random alphanumeric chars, stored in module‑level Map.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-server';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface FamilyMember {
  id: string;
  name: string;
  phone: string;
  role: 'admin' | 'member';
  joinedAt: string;
  protectionActive: boolean;
}

interface FamilyPlan {
  id: string;
  name: string;
  inviteCode: string;
  adminId: string;
  createdAt: string;
  members: FamilyMember[];
}

/* ------------------------------------------------------------------ */
/*  In‑memory stores (server‑side, persists for process lifetime)      */
/* ------------------------------------------------------------------ */

const familyPlans = new Map<string, FamilyPlan>();       // inviteCode → plan
const userFamilies = new Map<string, string>();         // userId → inviteCode

// Helper: 6-char alphanumeric invite code
function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I,O,0,1 to avoid confusion
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  // avoid duplicates
  if (familyPlans.has(code)) return generateCode();
  return code;
}

/* ------------------------------------------------------------------ */
/*  POST — Create / Join / Leave / Members                            */
/* ------------------------------------------------------------------ */

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { userId } = auth;
  let body: Record<string, any> = {};

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { action, planName, inviteCode, memberId } = body;

  // ── CREATE ──
  if (action === 'create') {
    if (userFamilies.has(userId)) {
      return NextResponse.json({ error: 'You already belong to a family plan' }, { status: 409 });
    }

    if (!planName || typeof planName !== 'string' || planName.trim().length === 0) {
      return NextResponse.json({ error: 'planName is required' }, { status: 400 });
    }

    const code = generateCode();
    const planId = `fam_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const plan: FamilyPlan = {
      id: planId,
      name: planName.trim(),
      inviteCode: code,
      adminId: userId,
      createdAt: new Date().toISOString(),
      members: [
        {
          id: userId,
          name: body.adminName || 'Admin',
          phone: body.adminPhone || '',
          role: 'admin',
          joinedAt: new Date().toISOString(),
          protectionActive: true,
        },
      ],
    };

    familyPlans.set(code, plan);
    userFamilies.set(userId, code);

    return NextResponse.json({ success: true, plan, inviteCode: code }, { status: 201 });
  }

  // ── JOIN ──
  if (action === 'join') {
    if (userFamilies.has(userId)) {
      return NextResponse.json({ error: 'You already belong to a family plan' }, { status: 409 });
    }

    if (!inviteCode || typeof inviteCode !== 'string') {
      return NextResponse.json({ error: 'inviteCode is required' }, { status: 400 });
    }

    const plan = familyPlans.get(inviteCode.toUpperCase());
    if (!plan) {
      return NextResponse.json({ error: 'Invalid invite code. Please check and try again.' }, { status: 404 });
    }

    const alreadyMember = plan.members.some(m => m.id === userId);
    if (alreadyMember) {
      return NextResponse.json({ error: 'You are already a member of this family' }, { status: 409 });
    }

    const member: FamilyMember = {
      id: userId,
      name: body.memberName || 'Member',
      phone: body.memberPhone || '',
      role: 'member',
      joinedAt: new Date().toISOString(),
      protectionActive: true,
    };

    plan.members.push(member);
    userFamilies.set(userId, plan.inviteCode);

    return NextResponse.json({ success: true, plan }, { status: 200 });
  }

  // ── LEAVE ──
  if (action === 'leave') {
    const code = userFamilies.get(userId);
    if (!code) {
      return NextResponse.json({ error: 'You are not in any family plan' }, { status: 404 });
    }

    const plan = familyPlans.get(code);
    if (!plan) {
      userFamilies.delete(userId);
      return NextResponse.json({ error: 'Family plan not found' }, { status: 404 });
    }

    // If admin leaves, disband the entire plan
    if (plan.adminId === userId) {
      for (const m of plan.members) {
        userFamilies.delete(m.id);
      }
      familyPlans.delete(code);
      return NextResponse.json({ success: true, message: 'Family plan disbanded (you were the admin)' });
    }

    // Remove member
    plan.members = plan.members.filter(m => m.id !== userId);
    userFamilies.delete(userId);

    return NextResponse.json({ success: true, message: 'You have left the family plan' });
  }

  // ── GET MEMBERS (explicit) ──
  if (action === 'members') {
    const code = userFamilies.get(userId);
    if (!code) {
      return NextResponse.json({ error: 'You are not in any family plan' }, { status: 404 });
    }

    const plan = familyPlans.get(code);
    if (!plan) {
      userFamilies.delete(userId);
      return NextResponse.json({ error: 'Family plan not found' }, { status: 404 });
    }

    return NextResponse.json({ plan });
  }

  return NextResponse.json({ error: `Unknown action: ${action}. Valid actions: create, join, leave, members` }, { status: 400 });
}

/* ------------------------------------------------------------------ */
/*  GET — Return family plan for current user                          */
/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { userId } = auth;

  const code = userFamilies.get(userId);
  if (!code) {
    return NextResponse.json({ plan: null, hasFamily: false });
  }

  const plan = familyPlans.get(code);
  if (!plan) {
    userFamilies.delete(userId);
    return NextResponse.json({ plan: null, hasFamily: false });
  }

  return NextResponse.json({ plan, hasFamily: true, inviteCode: code });
}
