'use client';

/**
 * Auth Callback — Supabase redirect after OTP verification
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export default function AuthCallbackPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/');
    } else {
      // Give it a moment for session to be restored
      const t = setTimeout(() => {
        const hasLocal = !!localStorage.getItem('callshield_user');
        if (hasLocal) {
          router.replace('/');
        } else {
          router.replace('/auth/login');
        }
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [isAuthenticated, router]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        :root{--bg:#050c07;--bg2:#091410;--card:#0d1c14;--border:#1a3326;--accent:#00e676;--fg:#e0f2e9;--muted:#4a6b58}
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'Space Grotesk',sans-serif;background:var(--bg);color:var(--fg)}
        .cb-bg{position:fixed;inset:0;background:radial-gradient(ellipse 600px 400px at 50% 20%,rgba(0,230,118,.05),transparent 60%)}
        .cb-wrap{position:relative;z-index:1;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px}
        .cb-spinner{width:40px;height:40px;border:3px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:cb-spin .8s linear infinite;margin-bottom:20px}
        @keyframes cb-spin{to{transform:rotate(360deg)}}
        .cb-text{font-size:13px;color:var(--muted)}
        .cb-logo{font-size:16px;font-weight:800;margin-bottom:32px;display:flex;align-items:center;gap:8px}
        .cb-logo i{color:var(--accent)}
      `}} />
      <div className="cb-bg" />
      <div className="cb-wrap">
        <div className="cb-logo">
          <i className="fas fa-shield-halved" /> CallShield India
        </div>
        <div className="cb-spinner" />
        <div className="cb-text">Completing sign in...</div>
      </div>
    </>
  );
}
