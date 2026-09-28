import React, { createContext, useContext, type ReactNode } from 'react';
import type { User } from '@react-native-firebase/auth';

import { strings } from '../../strings';

/**
 * Phone-only stand-in for src/auth.tsx — the default. Swapped in by
 * metro.config.js unless EXPO_PUBLIC_BACKEND=firebase. Exports must stay
 * identical to src/auth.tsx.
 *
 * There are no accounts: the app is always "signed in" as one fixed local user,
 * so the auth gate in app/_layout never shows the sign-in screen. The screen and
 * the Firebase auth code stay in the project for the paid cloud-sync build.
 */

interface AuthState {
  user: User | null;
  initializing: boolean;
  /** False here: no sign-in, no sign-out. Screens hide account actions. */
  accountsEnabled: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const LOCAL_USER = { uid: 'local', email: null, displayName: null } as unknown as User;

const noop = async () => {};

const VALUE: AuthState = {
  user: LOCAL_USER,
  initializing: false,
  accountsEnabled: false,
  signIn: noop,
  signUp: noop,
  signOut: noop,
  resetPassword: noop,
};

const AuthContext = createContext<AuthState>(VALUE);

export function authErrorMessage(_error: unknown): string {
  return strings.auth.errors.generic;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return <AuthContext.Provider value={VALUE}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

export function useUid(): string {
  return useAuth().user!.uid;
}
