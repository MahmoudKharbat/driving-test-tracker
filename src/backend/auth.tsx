/**
 * Auth entry point for the app. Screens import from here, never from a backend
 * folder directly.
 *
 * This re-exports the Firebase implementation so the typecheck sees the full
 * contract; metro.config.js swaps this file for ./local/auth.tsx in the default
 * phone-only build. See ./contract.ts.
 */
export * from './firebase/auth';
