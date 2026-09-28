import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  // v26 exports `User` directly; `FirebaseAuthTypes` was the pre-modular
  // namespace and is gone.
  type User,
} from '@react-native-firebase/auth';
import { getDoc, setDoc, serverTimestamp } from '@react-native-firebase/firestore';

import { userRef } from './db';
import { strings } from '../../strings';

/**
 * Email/password auth — chosen over phone OTP because it needs no SMS billing,
 * no test-number juggling in development, and this is a single-user MVP where
 * the sign-in happens roughly once per device.
 */

interface AuthState {
  user: User | null;
  /** True until the first auth state callback fires, so the router does not
   *  flash the sign-in screen at a user who is already signed in. */
  initializing: boolean;
  /** True in the Firebase build; the phone-only build has no accounts. */
  accountsEnabled: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Sends Firebase's reset link. Resolves even for unknown addresses on
   *  projects with email enumeration protection on, which is the point. */
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/**
 * Translate a Firebase auth error code into a Hebrew message.
 *
 * Sign-in failures are deliberately collapsed onto one message: Firebase
 * returns `auth/invalid-credential` (and historically `auth/wrong-password` /
 * `auth/user-not-found`) and distinguishing them for the user would confirm
 * which email addresses are registered.
 */
export function authErrorMessage(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';

  const e = strings.auth.errors;
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-login-credentials':
      return e.invalidCredentials;
    case 'auth/invalid-email':
      return e.emailInvalid;
    case 'auth/email-already-in-use':
      return e.emailInUse;
    case 'auth/weak-password':
      return e.weakPassword;
    case 'auth/network-request-failed':
      return e.networkFailed;
    case 'auth/too-many-requests':
      return e.tooManyRequests;
    default:
      return e.generic;
  }
}

/**
 * Create `users/{uid}` if it is missing.
 *
 * Runs on every sign-in rather than only at registration. Account creation and
 * the profile write are two operations that cannot be made atomic from the
 * client, so a crash or a dropped connection between them would otherwise leave
 * a permanently profile-less account. Checking on each sign-in repairs that.
 *
 * `role` is always 'tester' in Phase 1. The field is written now so the Phase 2
 * teacher role is a value change rather than a schema migration.
 */
async function ensureUserDoc(
  user: User,
  fallbackName: string,
): Promise<void> {
  const ref = userRef(user.uid);
  const snapshot = await getDoc(ref);
  if (snapshot.exists()) return;

  await setDoc(ref, {
    role: 'tester',
    name: fallbackName || user.displayName || user.email?.split('@')[0] || '',
    createdAt: serverTimestamp(),
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(getAuth(), (next) => {
      setUser(next);
      setInitializing(false);
      if (next) {
        // Fire-and-forget: a failure here must not block sign-in, and the next
        // sign-in will retry. Offline, the write queues in the local cache.
        void ensureUserDoc(next, '').catch(() => {});
      }
    });
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      initializing,
      accountsEnabled: true,
      signIn: async (email, password) => {
        const cred = await signInWithEmailAndPassword(
          getAuth(),
          email.trim(),
          password,
        );
        await ensureUserDoc(cred.user, '').catch(() => {});
      },
      signUp: async (email, password, name) => {
        const cred = await createUserWithEmailAndPassword(
          getAuth(),
          email.trim(),
          password,
        );
        await ensureUserDoc(cred.user, name.trim()).catch(() => {});
      },
      signOut: () => fbSignOut(getAuth()),
      resetPassword: (email) => sendPasswordResetEmail(getAuth(), email.trim()),
    }),
    [user, initializing],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/** The signed-in uid, for screens that render only behind the auth gate. */
export function useUid(): string {
  const { user } = useAuth();
  if (!user) throw new Error('useUid called outside the authenticated stack');
  return user.uid;
}
