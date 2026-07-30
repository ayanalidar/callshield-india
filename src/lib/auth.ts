/**
 * CallShield Auth — Unified exports
 *
 * Server-side: requireAuth (from auth-server)
 * Client-side: AuthProvider, useAuth (from auth-provider.tsx)
 */

// Server-side auth for API routes
export { requireAuth } from './auth-server';

// Client-side auth — JSX context lives in auth-provider.tsx
export { AuthProvider, useAuth } from './auth-provider';
