// v26 of the SDK exposes these directly; the old `FirebaseFirestoreTypes`
// namespace belonged to the pre-modular API and no longer exists.
import type { Timestamp } from '@react-native-firebase/firestore';

/**
 * Firestore layout (every document scoped under `testers/{uid}` from day one so
 * multi-tester and the Phase 2 teacher-role split are additive, not migrations):
 *
 *   config/cities
 *   users/{uid}
 *   testers/{uid}/teachers/{teacherId}
 *   testers/{uid}/teachers/{teacherId}/tests/{testId}
 *   testers/{uid}/teacherStats/{teacherId}
 */

/** `config/cities` — a document, never a hardcoded constant, so a city can be
 *  added without shipping an app store release. */
export interface CitiesConfig {
  list: string[];
}

/** Phase 1 only ever writes 'tester'. The field exists now so the Phase 2
 *  teacher role is a value change rather than a schema change. */
export type UserRole = 'tester' | 'teacher';

export interface UserDoc {
  role: UserRole;
  name: string;
  createdAt: Timestamp;
}

/**
 * ONE canonical document per real person. This is the fix for the source
 * sheet's central defect, where a teacher was a free-text string and typos
 * (`דפוס יעקב(קובי)-נתניה` vs `דפס יעקב(קובי)-נתניה`) silently split one
 * person's record in two.
 *
 * `city` is a separate enum field — it is never appended into `name`.
 */
export interface Teacher {
  name: string;
  city: string;
  createdAt: Timestamp;
}

export type TestResult = 'pass' | 'fail';

/**
 * `date` is a real Timestamp. The source sheet stored bare numbers (`5.6`
 * meaning 5 June) and at least one comma-separated string (`5,6`), which made
 * sorting and filtering unreliable.
 *
 * Optional fields are reserved for Phase 2 and are additive by construction —
 * absent on existing documents, never breaking a read.
 */
export interface Test {
  date: Timestamp;
  result: TestResult;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  testType?: string;
  notes?: string;
  vehicleType?: string;
}

/**
 * Maintained exclusively by the Cloud Function on test create/update/delete.
 * Replaces the sheet's live QUERY/PIVOT and stays O(1) to read no matter how
 * many years of tests accumulate — never compute this client-side by reading
 * every test document.
 */
export interface TeacherStats {
  passed: number;
  failed: number;
  total: number;
  updatedAt: Timestamp;
}

/** A teacher joined to its stats doc, as the list and detail screens consume it. */
export interface TeacherWithStats {
  id: string;
  name: string;
  city: string;
  createdAt: Timestamp | null;
  passed: number;
  failed: number;
  total: number;
  /** null until the Cloud Function has written stats for this teacher. */
  lastTestedAt: Timestamp | null;
  /** false when no stats document exists yet (freshly created teacher, or the
   *  aggregation is still in flight). Lets the UI distinguish "0 tests" from
   *  "not counted yet". */
  hasStats: boolean;
}

export interface TestWithId extends Test {
  id: string;
}

export type TeacherSort = 'mostTests' | 'lowestPassRate' | 'recentlyTested' | 'name';
