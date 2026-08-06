/**
 * Admin authentication helpers — token-based with HMAC-SHA256 signing.
 * Uses Web Crypto API (no external deps).
 */

import { NextRequest, NextResponse } from 'next/server';

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'callshield_admin_2024';
const TOKEN_SECRET = process.env.ADMIN_TOKEN_SECRET || ADMIN_PASSWORD + '_hmac_secret_2024';
const TOKEN_COOKIE = 'admin_token';
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ── Crypto helpers ──────────────────────────────────────────────

async function hmacSha256(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function base64UrlEncode(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(data);
  const bin = String.fromCharCode(...bytes);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function base64UrlDecode(data: string): Promise<string> {
  let b64 = data.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

// ── Token helpers ───────────────────────────────────────────────

export async function createAdminToken(username: string): Promise<string> {
  const payload = {
    sub: username,
    iat: Date.now(),
    exp: Date.now() + TOKEN_TTL_MS,
    jti: crypto.randomUUID(),
  };
  const header = { alg: 'HS256', typ: 'JWT' };
  const hdrB64 = await base64UrlEncode(JSON.stringify(header));
  const pldB64 = await base64UrlEncode(JSON.stringify(payload));
  const sig = await hmacSha256(`${hdrB64}.${pldB64}`, TOKEN_SECRET);
  const sigB64 = await base64UrlEncode(sig);
  return `${hdrB64}.${pldB64}.${sigB64}`;
}

export async function verifyAdminToken(token: string): Promise<{ username: string } | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [hdrB64, pldB64, sigB64] = parts;

    // Verify signature
    const expectedSig = await hmacSha256(`${hdrB64}.${pldB64}`, TOKEN_SECRET);
    const expectedSigB64 = await base64UrlEncode(expectedSig);
    if (expectedSigB64 !== sigB64) return null;

    // Decode payload
    const pldJson = await base64UrlDecode(pldB64);
    const payload = JSON.parse(pldJson);

    // Check expiry
    if (Date.now() > payload.exp) return null;

    return { username: payload.sub };
  } catch {
    return null;
  }
}

// ── Request helpers ─────────────────────────────────────────────

/** Extract and verify admin token from request cookies. */
export async function getAdminFromRequest(request: NextRequest): Promise<{ username: string } | null> {
  const token = request.cookies.get(TOKEN_COOKIE)?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

/** Return 401 if not authenticated. Returns null if authenticated. */
export async function requireAdmin(request: NextRequest): Promise<NextResponse | null> {
  const admin = await getAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  }
  return null;
}

// ── Utility exports ─────────────────────────────────────────────

export { ADMIN_USERNAME, ADMIN_PASSWORD, TOKEN_COOKIE, TOKEN_TTL_MS };
