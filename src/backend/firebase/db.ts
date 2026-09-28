import { getApp } from '@react-native-firebase/app';
import {
  getFirestore,
  initializeFirestore,
  collection,
  doc,
} from '@react-native-firebase/firestore';
import type {
  CollectionReference,
  DocumentReference,
} from '@react-native-firebase/firestore';

/**
 * Firestore offline persistence.
 *
 * This is why the app uses @react-native-firebase (native SDKs) rather than the
 * `firebase` JS SDK: the JS SDK's persistence layer is built on IndexedDB, which
 * React Native does not provide, so `persistentLocalCache()` is a no-op there and
 * logs "This platform is either missing IndexedDB...". See
 * https://github.com/firebase/firebase-js-sdk/issues/7947 — open since Jan 2024.
 *
 * The native SDKs enable disk persistence by default; this call is explicit so
 * the guarantee is visible in code and cannot be silently lost. It must run
 * before any other Firestore interaction, hence the module-level side effect:
 * auth.tsx and data.ts both import this module, so it has run before either
 * touches Firestore.
 *
 * Consequence for the reader: writes queue on disk while offline and flush on
 * reconnect. Reads are served from cache. He logs tests between test centres on
 * patchy connectivity, so this is a product requirement, not a nicety.
 */
initializeFirestore(getApp(), {
  persistence: true,
  // Unbounded local cache. A tester logs a handful of documents a day; the cache
  // will not approach a size worth evicting, and eviction would defeat offline
  // reads of the teacher list.
  cacheSizeBytes: -1,
});

export const db = getFirestore();

/* ── Typed collection/document paths ──────────────────────────────────────────
 * Every accessor is scoped under testers/{uid}. Nothing in the app builds a
 * Firestore path by hand, so the "scoped from day one" constraint is enforced
 * structurally rather than by convention.
 */

type DocRef = DocumentReference;
type CollRef = CollectionReference;

/** config/cities — read-only to clients, seeded once by script. */
export const citiesConfigRef = (): DocRef => doc(db, 'config', 'cities');

/** Cities the tester added himself, merged after config/cities in the app. */
export const testerCitiesRef = (uid: string): DocRef =>
  doc(db, 'testers', uid, 'settings', 'cities');

export const userRef = (uid: string): DocRef => doc(db, 'users', uid);

export const teachersRef = (uid: string): CollRef =>
  collection(db, 'testers', uid, 'teachers');

export const teacherRef = (uid: string, teacherId: string): DocRef =>
  doc(db, 'testers', uid, 'teachers', teacherId);

export const testsRef = (uid: string, teacherId: string): CollRef =>
  collection(db, 'testers', uid, 'teachers', teacherId, 'tests');

export const testRef = (
  uid: string,
  teacherId: string,
  testId: string,
): DocRef => doc(db, 'testers', uid, 'teachers', teacherId, 'tests', testId);

export const teacherStatsCollectionRef = (uid: string): CollRef =>
  collection(db, 'testers', uid, 'teacherStats');

export const teacherStatsRef = (uid: string, teacherId: string): DocRef =>
  doc(db, 'testers', uid, 'teacherStats', teacherId);
