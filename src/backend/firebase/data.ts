import { useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  arrayUnion,
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
  testerCitiesRef,
  testsRef,
} from './db';
import type {
  ImportBatch,
  ImportResult,
  MonthStats,
  TeacherWithStats,
  TestResult,
  TestWithId,
} from '../../types';
import { mergeCities, normalizeCityName } from '../../lib/cities';
import { shareCsv, type ExportRow } from '../../lib/csv';

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
 * Cities: the seeded `config/cities` followed by the tester's own additions.
 *
 * Live subscriptions rather than one-off reads, so adding a city in the
 * console reaches the running app without a restart — and, with persistence on,
 * the last known lists are served from cache while offline.

 */
export function useCities(uid: string): { cities: string[]; loading: boolean } {
  const [seeded, setSeeded] = useState<string[] | null>(null);
  const [custom, setCustom] = useState<string[] | null>(null);

  useEffect(() => {
    const unsubSeeded = onSnapshot(
      citiesConfigRef(),
      (snap) => {
        const list = snap.exists() ? (snap.data()?.list as string[] | undefined) : undefined;
        setSeeded(Array.isArray(list) && list.length ? list : FALLBACK_CITIES);
      },
      () => setSeeded(FALLBACK_CITIES),
    );

    const unsubCustom = onSnapshot(
      testerCitiesRef(uid),
      (snap) => {
        const list = snap.exists() ? (snap.data()?.list as string[] | undefined) : undefined;
        setCustom(Array.isArray(list) ? list : []);
      },
      () => setCustom([]),
    );

    return () => {
      unsubSeeded();
      unsubCustom();
    };
  }, [uid]);

  const cities = useMemo(
    () => mergeCities(seeded ?? [], custom ?? []),
    [seeded, custom],
  );

  return { cities, loading: seeded === null || custom === null };
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
      {
        passed: number;
        failed: number;
        total: number;
        lastTestDate: Timestamp | null;
        byMonth: Record<string, MonthStats>;
      }
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
        const next: typeof stats = {};
        for (const d of snap.docs) {
          const data = d.data() as Record<string, unknown>;
          next[d.id] = {
            passed: Number(data.passed ?? 0),
            failed: Number(data.failed ?? 0),
            total: Number(data.total ?? 0),
            lastTestDate: (data.lastTestDate as Timestamp | undefined) ?? null,
            byMonth: readByMonth(data.byMonth),
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
          byMonth: s?.byMonth ?? {},
        };
      }),
    [rawTeachers, stats],
  );

  return { teachers, loading: !teachersLoaded || !statsLoaded };
}

/** `byMonth` from a teacherStats document. Absent on documents written before
 *  it existed; those fill in on the teacher's next test write. */
function readByMonth(raw: unknown): Record<string, MonthStats> {
  const out: Record<string, MonthStats> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [key, value] of Object.entries(raw as Record<string, Record<string, unknown>>)) {
    const last = value?.lastTestDate as Timestamp | undefined;
    if (!last) continue;
    out[key] = {
      passed: Number(value.passed ?? 0),
      failed: Number(value.failed ?? 0),
      lastTestedAt: last,
    };
  }
  return out;
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

export { filterAndSortTeachers, passRate } from '../../lib/teachers';

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

/**
 * Add a city to this tester's own list. `arrayUnion` keeps concurrent or
 * repeated adds from duplicating, and `merge` creates the document on first use.
 */
export function addCity(uid: string, city: string): void {
  void setDoc(
    testerCitiesRef(uid),
    { list: arrayUnion(normalizeCityName(city)) },
    { merge: true },
  ).catch(onWriteError('addCity'));
}

/**
 * Write a cleaned spreadsheet import.
 *
 * Existing teachers' tests are read first (reads resolve from cache offline) so
 * a re-import skips tests already recorded on the same date with the same
 * result — once per existing copy, since two students of one teacher on one day
 * is common. Writes go out in batches and are not awaited, like every other
 * write here; the Cloud Function recounts stats as the tests land.
 */
export async function importBatch(uid: string, batch: ImportBatch): Promise<ImportResult> {
  const have = new Map<string, number>();
  for (const t of batch.teachers) {
    if (!t.existingId) continue;
    const snap = await getDocs(testsRef(uid, t.existingId));
    for (const d of snap.docs) {
      const data = d.data() as { date?: Timestamp; result?: TestResult };
      if (!data.date || !data.result) continue;
      const k = `${t.existingId}|${data.date.toMillis()}|${data.result}`;
      have.set(k, (have.get(k) ?? 0) + 1);
    }
  }

  const ops: ((b: ReturnType<typeof writeBatch>) => void)[] = [];
  const idFor = new Map<string, string>();
  let teachersAdded = 0;
  for (const t of batch.teachers) {
    if (t.existingId) {
      idFor.set(t.tempId, t.existingId);
      continue;
    }
    const ref = doc(teachersRef(uid));
    idFor.set(t.tempId, ref.id);
    ops.push((b) => b.set(ref, { name: t.name.trim(), city: t.city, createdAt: serverTimestamp() }));
    teachersAdded++;
  }

  let testsAdded = 0;
  let testsSkipped = 0;
  for (const t of batch.tests) {
    const teacherId = idFor.get(t.tempId);
    if (!teacherId) continue;
    const k = `${teacherId}|${t.date.getTime()}|${t.result}`;
    const n = have.get(k) ?? 0;
    if (n > 0) {
      have.set(k, n - 1);
      testsSkipped++;
      continue;
    }
    const ref = doc(testsRef(uid, teacherId));
    ops.push((b) =>
      b.set(ref, { date: Timestamp.fromDate(t.date), result: t.result, createdAt: serverTimestamp() }),
    );
    testsAdded++;
  }

  if (batch.newCities.length) {
    void setDoc(
      testerCitiesRef(uid),
      { list: arrayUnion(...batch.newCities.map(normalizeCityName)) },
      { merge: true },
    ).catch(onWriteError('importBatch:cities'));
  }

  // Batches cap at 500 operations.
  const CHUNK = 400;
  for (let i = 0; i < ops.length; i += CHUNK) {
    const b = writeBatch(db);
    ops.slice(i, i + CHUNK).forEach((op) => op(b));
    void b.commit().catch(onWriteError('importBatch'));
  }

  return { teachersAdded, testsAdded, testsSkipped };
}

/**
 * Every test as a CSV file, handed to the share sheet.
 *
 * Reads each teacher's tests once — an occasional, user-initiated export, not a
 * substitute for teacherStats. Reads resolve from the local cache offline.
 */
export async function exportTestsCsv(uid: string): Promise<void> {
  const teacherSnap = await getDocs(teachersRef(uid));
  const rows: ExportRow[] = [];
  for (const t of teacherSnap.docs) {
    const teacher = t.data() as { name?: string; city?: string };
    const testSnap = await getDocs(testsRef(uid, t.id));
    for (const d of testSnap.docs) {
      const test = d.data() as { date?: Timestamp; result?: TestResult };
      if (!test.date || !test.result) continue;
      rows.push({
        date: test.date.toDate(),
        teacher: String(teacher.name ?? ''),
        city: String(teacher.city ?? ''),
        result: test.result,
      });
    }
  }
  await shareCsv(rows);
}
