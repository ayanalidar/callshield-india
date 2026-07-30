'use client';

/**
 * CallShield Auth Context
 * Phone OTP auth via Supabase Auth, session persistence.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

// ============================================================
// TYPES
// ============================================================

export interface AuthUser {
  id: string;
  phone: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  sendOtp: (phone: string) => Promise<{ success: boolean; error?: string }>;
  verifyOtp: (phone: string, otp: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
}

// ============================================================
// CONTEXT
// ============================================================

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// ============================================================
// PROVIDER
// ============================================================

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    restoreSession();
  }, []);

  const restoreSession = async () => {
    try {
      const res = await fetch('/api/auth/session');
      if (res.ok) {
        const data = await res.json();
        if (data.user) setUser(data.user);
      }
    } catch {
      // no session
    } finally {
      setLoading(false);
    }
  };

  // Listen for auth state changes (for multi-tab sync)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'callshield_user') {
        try {
          setUser(e.newValue ? JSON.parse(e.newValue) : null);
        } catch {
          setUser(null);
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const persistUser = useCallback((u: AuthUser | null) => {
    setUser(u);
    if (u) {
      localStorage.setItem('callshield_user', JSON.stringify(u));
    } else {
      localStorage.removeItem('callshield_user');
    }
  }, []);

  const sendOtp = useCallback(async (phone: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        return { success: false, error: data.error || 'Failed to send OTP' };
      }
      return { success: true };
    } catch {
      return { success: false, error: 'Network error' };
    }
  }, []);

  const verifyOtp = useCallback(async (phone: string, otp: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        return { success: false, error: data.error || 'Invalid OTP' };
      }
      if (data.user) {
        persistUser(data.user);
      }
      return { success: true };
    } catch {
      return { success: false, error: 'Network error' };
    }
  }, [persistUser]);

  const signOut = useCallback(async () => {
    try {
      await fetch('/api/auth/signout', { method: 'POST' });
    } catch {
      // best effort
    }
    persistUser(null);
  }, [persistUser]);

  return (
    <AuthContext.Provider value={{ user, loading, sendOtp, verifyOtp, signOut, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}
