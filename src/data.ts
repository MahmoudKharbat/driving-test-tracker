import { useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  Timestamp,
} from '@react-native-firebase/firestore';

import {
  citiesConfigRef,
  db,
  teacherRef,
  teacherStatsCollectionRef,
  teachersRef,
  testRef,
  testsRef,
} from './firebase';
import type {
  TeacherSort,
  TeacherWithStats,
  TestResult,
  TestWithId,
} from './types';
import { normalizeName } from './lib/hebrewName';

/** Fallback used only if `config/cities` cannot be read at all — an empty
 *  dropdown would make the app unusable, and these are the six cities in use.
 *  The document remains the source of truth whenever it is reachable. */
const FALLBACK_CITIES = [
  'כפר סבא',
  'אריאל',
  'חדרה',
  'פתח תקווה',
  'נתניה',
  'הרצליה',
];

/**
 * Cities from `config/cities`.
 *
 * A live subscription rather than a one-off read, so adding a city in the
 * console reaches the running app without a restart — and, with persistence on,
 * the last known list is served from cache while offline.
 */
export function useCities(): { cities: string[]; loading: boolean } {
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onSnapshot(
      citiesConfigRef(),
      (snap) => {
        const list = snap.exists() ? (snap.data()?.list as string[] | undefined) : undefined;
        setCities(Array.isArray(list) && list.length ? list : FALLBACK_CITIES);
        setLoading(false);
      },
      () => {
        setCities(FALLBACK_CITIES);
        setLoading(false);
      },
    );
  }, []);

  return { cities, loading };
}

/**
 * All teachers joined to their aggregate stats.
 *
 * Two subscriptions joined in memory. With persistence enabled the initial sync
 * is the only expensive one; afterwards Firestore streams deltas and reads are
 * served from the local cache, which is also what keeps the list working with
 * no connection.
 *
 * The join is a left join on purpose: a teacher created seconds ago has no
 * stats document until the Cloud Function runs, and must still appear in the
 * list immediately rather than blink into existence later.
 */
export function useTeachers(uid: string): {
  teachers: TeacherWithStats[];
  loading: boolean;
} {
  const [rawTeachers, setRawTeachers] = useState<
    { id: string; name: string; city: string; createdAt: Timestamp | null }[]
  >([]);
  const [stats, setStats] = useState<
    Record<
      string,
      { passed: number; failed: number; total: number; lastTestDate: Timestamp | null }
    >
  >({});
  const [teachersLoaded, setTeachersLoaded] = useState(false);
  const [statsLoaded, setStatsLoaded] = useState(false);

  useEffect(() => {
    const unsubTeachers = onSnapshot(
      teachersRef(uid),
      (snap) => {
        setRawTeachers(
          snap.docs.map((d) => {
            const data = d.data() as Record<string, unknown>;
            return {
              id: d.id,
              name: String(data.name ?? ''),
              city: String(data.city ?? ''),
              createdAt: (data.createdAt as Timestamp | undefined) ?? null,
            };
          }),
        );
        setTeachersLoaded(true);
      },
      () => setTeachersLoaded(true),
    );

    const unsubStats = onSnapshot(
      teacherStatsCollectionRef(uid),
      (snap) => {
        const next: Record<
          string,
          { passed: number; failed: number; total: number; lastTestDate: Timestamp | null }
        > = {};
        for (const d of snap.docs) {
          const data = d.data() as Record<string, unknown>;
          next[d.id] = {
            passed: Number(data.passed ?? 0),
            failed: Number(data.failed ?? 0),
            total: Number(data.total ?? 0),
            lastTestDate: (data.lastTestDate as Timestamp | undefined) ?? null,
          };
        }
        setStats(next);
        setStatsLoaded(true);
      },
      () => setStatsLoaded(true),
    );

    return () => {
      unsubTeachers();
      unsubStats();
    };
  }, [uid]);

  const teachers = useMemo<TeacherWithStats[]>(
    () =>
      rawTeachers.map((t) => {
        const s = stats[t.id];
        return {
          ...t,
          passed: s?.passed ?? 0,
          failed: s?.failed ?? 0,
          total: s?.total ?? 0,
          lastTestedAt: s?.lastTestDate ?? null,
          hasStats: Boolean(s),
        };
      }),
    [rawTeachers, stats],
  );

  return { teachers, loading: !teachersLoaded || !statsLoaded };
}

/** Chronological test history for one teacher, newest first. */
export function useTests(
  uid: string,
  teacherId: string,
): { tests: TestWithId[]; loading: boolean } {
  const [tests, setTests] = useState<TestWithId[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(testsRef(uid, teacherId), orderBy('date', 'desc'));
    return onSnapshot(
      q,
      (snap) => {
        setTests(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as TestWithId),
        );
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [uid, teacherId]);

  return { tests, loading };
}

/** Pass rate as a whole-number percentage; 0 when no tests are recorded. */
export function passRate(passed: number, total: number): number {
  return total > 0 ? Math.round((passed / total) * 100) : 0;
}

/**
 * Apply the search box, the city filter and the sort selector.
 *
 * Search runs over the normalised name, so a query typed without the
 * punctuation or city suffix that happens to be stored in the record still
 * finds it.
 */
export function filterAndSortTeachers(
  teachers: TeacherWithStats[],
  opts: { search: string; city: string | null; sort: TeacherSort; cities: string[] },
): TeacherWithStats[] {
  const needle = normalizeName(opts.search, opts.cities);

  const filtered = teachers.filter((t) => {
    if (opts.city && t.city !== opts.city) return false;
    if (!needle) return true;
    return normalizeName(t.name, opts.cities).includes(needle);
  });

  const byName = (a: TeacherWithStats, b: TeacherWithStats) =>
    a.name.localeCompare(b.name, 'he');

  return [...filtered].sort((a, b) => {
    switch (opts.sort) {
      case 'mostTests':
        return b.total - a.total || byName(a, b);
      case 'lowestPassRate':
        // Teachers with no tests have no rate to speak of; parking them last
        // keeps the top of the list meaningful rather than filled with 0%.
        if (a.total === 0 && b.total === 0) return byName(a, b);
        if (a.total === 0) return 1;
        if (b.total === 0) return -1;
        return (
          passRate(a.passed, a.total) - passRate(b.passed, b.total) || byName(a, b)
        );
      case 'recentlyTested': {
        const at = a.lastTestedAt?.toMillis() ?? -1;
        const bt = b.lastTestedAt?.toMillis() ?? -1;
        return bt - at || byName(a, b);
      }
      case 'name':
      default:
        return byName(a, b);
    }
  });
}

/* ── Writes ───────────────────────────────────────────────────────────────────
 *
 * None of these return a promise the UI is meant to await, and that is the
 * single most important thing about this file.
 *
 * A Firestore write promise resolves only when the *server* acknowledges the
 * write. With no connection it stays pending indefinitely — it does not reject,
 * and it does not resolve on the local commit. See
 * https://github.com/firebase/firebase-js-sdk/issues/6515.
 *
 * Awaiting one would therefore freeze the app in precisely the situation it was
 * built for: a save button spinning forever between test centres while the data
 * had in fact already been written to disk. What actually matters happens
 * synchronously — the write lands in the local cache and every onSnapshot
 * listener fires at once, so the UI is already correct.
 *
 * These functions are therefore synchronous. Failures are reported through
 * `onWriteError` rather than through a rejected promise the caller is awaiting;
 * a genuine failure (a rules rejection, say) surfaces later, not at call time.
 */

/** Reports a write rejection. A rules violation or a malformed document lands
 *  here, typically long after the call. Left as a console warning: there is no
 *  screen still on-screen to show it against, and silently swallowing it would
 *  make a permissions misconfiguration invisible in development. */
function onWriteError(operation: string) {
  return (error: unknown) => {
    console.warn(`[firestore] ${operation} failed to sync`, error);
  };
}

/**
 * Create a teacher and return its id immediately.
 *
 * The id is generated client-side by `doc()` rather than taken from a resolved
 * `addDoc()`, so the caller can select the new teacher and carry straight on
 * with logging the test without waiting for a round trip that will not complete
 * while offline.
 */
export function createTeacher(uid: string, name: string, city: string): string {
  const ref = doc(teachersRef(uid));
  void setDoc(ref, {
    name: name.trim(),
    city,
    createdAt: serverTimestamp(),
  }).catch(onWriteError('createTeacher'));
  return ref.id;
}

export function createTest(
  uid: string,
  teacherId: string,
  date: Date,
  result: TestResult,
): void {
  void addDoc(testsRef(uid, teacherId), {
    // A real Timestamp, never a bare number or a string. The source sheet stored
    // "5.6" for 5 June and at least one value as the text "5,6", which is what
    // made date filtering and sorting unreliable there.
    date: Timestamp.fromDate(date),
    result,
    createdAt: serverTimestamp(),
  }).catch(onWriteError('createTest'));
}

export function updateTest(
  uid: string,
  teacherId: string,
  testId: string,
  date: Date,
  result: TestResult,
): void {
  void updateDoc(testRef(uid, teacherId, testId), {
    date: Timestamp.fromDate(date),
    result,
    updatedAt: serverTimestamp(),
  }).catch(onWriteError('updateTest'));
}

export function deleteTest(uid: string, teacherId: string, testId: string): void {
  void deleteDoc(testRef(uid, teacherId, testId)).catch(onWriteError('deleteTest'));
}

/**
 * Delete a teacher and every test recorded against them.
 *
 * Firestore does not cascade, so deleting only the parent would strand the
 * tests as unreachable documents that still drive the aggregate. The stats
 * document is left to the Cloud Function, which tears it down once the last
 * test is removed.
 *
 * The `getDocs` read is awaited because reads — unlike writes — do resolve
 * offline, falling back to the local cache. The deletes that follow are not
 * awaited, for the reason described above.
 */
export async function deleteTeacherWithTests(
  uid: string,
  teacherId: string,
): Promise<void> {
  const snap = await getDocs(testsRef(uid, teacherId));

  // Batches cap at 500 operations.
  const CHUNK = 400;
  for (let i = 0; i < snap.docs.length; i += CHUNK) {
    const batch = writeBatch(db);
    for (const d of snap.docs.slice(i, i + CHUNK)) batch.delete(d.ref);
    void batch.commit().catch(onWriteError('deleteTeacherWithTests:tests'));
  }

  void deleteDoc(teacherRef(uid, teacherId)).catch(
    onWriteError('deleteTeacherWithTests:teacher'),
  );
}

/** Seed `config/cities` from the app. Used only by the setup script; clients
 *  are denied writes to `config/*` by the security rules. */
export async function seedCities(cities: string[]): Promise<void> {
  await setDoc(citiesConfigRef(), { list: cities });
}
