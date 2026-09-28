import { useMemo, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Timestamp } from '@react-native-firebase/firestore';

import type { TeacherWithStats, TestResult, TestWithId } from '../../types';
import { mergeCities, normalizeCityName } from '../../lib/cities';
import { shareCsv } from '../../lib/csv';

export { filterAndSortTeachers, passRate } from '../../lib/teachers';

/**
 * Phone-only data layer — the default. Swapped in for src/data.ts by
 * metro.config.js unless EXPO_PUBLIC_BACKEND=firebase. Exports must stay
 * identical to src/data.ts.
 *
 * Everything lives in AsyncStorage on the device: no account, no network.
 * Stats are derived here from the tests on the phone — with no server there is
 * no Cloud Function to maintain them, and reading local storage costs nothing.
 *
 * Storage layout (versioned, so a future cloud upload can read it as-is):
 *   dt:v1:teachers          StoredTeacher[]
 *   dt:v1:cities            string[]          — his own additions
 *   dt:v1:tests:{teacherId} StoredTest[]      — one key per teacher, so no
 *                                               single entry grows with years
 *                                               of records
 * Ids are Firestore-style 20-character auto-ids and dates are epoch millis, so
 * the same records can be written to testers/{uid}/... unchanged when cloud sync
 * is switched on.
 *
 * A fresh install starts empty — no teachers, no cities. He adds his own test
 * centres from the add sheet.
 */

const PREFIX = 'dt:v1:';
const TEACHERS_KEY = `${PREFIX}teachers`;
const CITIES_KEY = `${PREFIX}cities`;
const TESTS_PREFIX = `${PREFIX}tests:`;

interface StoredTeacher {
  id: string;
  name: string;
  city: string;
  createdAt: number;
}

interface StoredTest {
  id: string;
  date: number;
  result: TestResult;
  createdAt: number;
  updatedAt?: number;
}

/* ── State ───────────────────────────────────────────────────────────────── */

let teachers: StoredTeacher[] = [];
let customCities: string[] = [];
let tests: Record<string, StoredTest[]> = {};
let hydrated = false;

/** Writes made before storage has loaded, replayed once it has — otherwise
 *  the load would overwrite them. */
let pending: (() => void)[] = [];

let version = 0;
const listeners = new Set<() => void>();

function emit() {
  version++;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function useVersion(): number {
  return useSyncExternalStore(subscribe, () => version);
}

function mutate(fn: () => void) {
  if (!hydrated) {
    pending.push(fn);
    return;
  }
  fn();
  emit();
}

/* ── Persistence ─────────────────────────────────────────────────────────── */

/** Fire-and-forget, like every write in the Firebase layer: the in-memory
 *  store is already updated and every screen has re-rendered. */
function save(key: string, value: unknown) {
  void AsyncStorage.setItem(key, JSON.stringify(value)).catch((error) =>
    console.warn(`[local] saving ${key} failed`, error),
  );
}

function drop(key: string) {
  void AsyncStorage.removeItem(key).catch((error) =>
    console.warn(`[local] removing ${key} failed`, error),
  );
}

async function hydrate() {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PREFIX));
    const entries = await AsyncStorage.multiGet(keys);
    for (const [key, raw] of entries) {
      if (!raw) continue;
      const value = JSON.parse(raw);
      if (key === TEACHERS_KEY) teachers = value;
      else if (key === CITIES_KEY) customCities = value;
      else if (key.startsWith(TESTS_PREFIX)) tests[key.slice(TESTS_PREFIX.length)] = value;
    }
  } catch (error) {
    console.warn('[local] loading data failed', error);
  }
  hydrated = true;
  const queued = pending;
  pending = [];
  queued.forEach((fn) => fn());
  emit();
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

const ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** Same shape as a Firestore auto-id, so records upload without re-keying. */
function newId(): string {
  let id = '';
  for (let i = 0; i < 20; i++) id += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
  return id;
}

/** Just enough of Firestore's Timestamp for the screens and sorts. */
function ts(ms: number): Timestamp {
  return {
    toDate: () => new Date(ms),
    toMillis: () => ms,
    seconds: Math.floor(ms / 1000),
    nanoseconds: 0,
  } as unknown as Timestamp;
}

function toTest(t: StoredTest): TestWithId {
  return {
    id: t.id,
    date: ts(t.date),
    result: t.result,
    createdAt: ts(t.createdAt),
    ...(t.updatedAt ? { updatedAt: ts(t.updatedAt) } : {}),
  };
}

void hydrate();

/* ── Reads ───────────────────────────────────────────────────────────────── */

export function useCities(_uid: string): { cities: string[]; loading: boolean } {
  const v = useVersion();
  const cities = useMemo(
    () => mergeCities([], customCities),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [v],
  );
  return { cities, loading: !hydrated };
}

export function useTeachers(_uid: string): {
  teachers: TeacherWithStats[];
  loading: boolean;
} {
  const v = useVersion();
  const list = useMemo<TeacherWithStats[]>(
    () =>
      teachers.map((t) => {
        const own = tests[t.id] ?? [];
        const passed = own.filter((x) => x.result === 'pass').length;
        const last = own.reduce<number | null>(
          (acc, x) => (acc === null || x.date > acc ? x.date : acc),
          null,
        );
        return {
          id: t.id,
          name: t.name,
          city: t.city,
          createdAt: ts(t.createdAt),
          passed,
          failed: own.length - passed,
          total: own.length,
          lastTestedAt: last === null ? null : ts(last),
          // Always current: there is no aggregation step to wait for.
          hasStats: true,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [v],
  );
  return { teachers: list, loading: !hydrated };
}

export function useTests(
  _uid: string,
  teacherId: string,
): { tests: TestWithId[]; loading: boolean } {
  const v = useVersion();
  const list = useMemo(
    () => [...(tests[teacherId] ?? [])].sort((a, b) => b.date - a.date).map(toTest),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [v, teacherId],
  );
  return { tests: list, loading: !hydrated };
}

/* ── Writes (synchronous, like the Firebase ones) ────────────────────────── */

export function createTeacher(_uid: string, name: string, city: string): string {
  const id = newId();
  mutate(() => {
    teachers = [...teachers, { id, name: name.trim(), city, createdAt: Date.now() }];
    save(TEACHERS_KEY, teachers);
  });
  return id;
}

function setTests(teacherId: string, next: StoredTest[]) {
  tests = { ...tests, [teacherId]: next };
  save(TESTS_PREFIX + teacherId, next);
}

export function createTest(
  _uid: string,
  teacherId: string,
  date: Date,
  result: TestResult,
): void {
  mutate(() =>
    setTests(teacherId, [
      ...(tests[teacherId] ?? []),
      { id: newId(), date: date.getTime(), result, createdAt: Date.now() },
    ]),
  );
}

export function updateTest(
  _uid: string,
  teacherId: string,
  testId: string,
  date: Date,
  result: TestResult,
): void {
  mutate(() =>
    setTests(
      teacherId,
      (tests[teacherId] ?? []).map((t) =>
        t.id === testId
          ? { ...t, date: date.getTime(), result, updatedAt: Date.now() }
          : t,
      ),
    ),
  );
}

export function deleteTest(_uid: string, teacherId: string, testId: string): void {
  mutate(() =>
    setTests(
      teacherId,
      (tests[teacherId] ?? []).filter((t) => t.id !== testId),
    ),
  );
}

export async function deleteTeacherWithTests(
  _uid: string,
  teacherId: string,
): Promise<void> {
  mutate(() => {
    teachers = teachers.filter((t) => t.id !== teacherId);
    const { [teacherId]: _removed, ...rest } = tests;
    tests = rest;
    save(TEACHERS_KEY, teachers);
    drop(TESTS_PREFIX + teacherId);
  });
}

export function addCity(_uid: string, city: string): void {
  const name = normalizeCityName(city);
  mutate(() => {
    if (customCities.includes(name)) return;
    customCities = [...customCities, name];
    save(CITIES_KEY, customCities);
  });
}

/* ── Export ──────────────────────────────────────────────────────────────── */

/** Every test as a CSV file, handed to the share sheet. On a phone-only
 *  install this is the backup. */
export async function exportTestsCsv(_uid: string): Promise<void> {
  const byId = new Map(teachers.map((t) => [t.id, t]));
  const rows = Object.entries(tests).flatMap(([teacherId, list]) => {
    const teacher = byId.get(teacherId);
    if (!teacher) return [];
    return list.map((t) => ({
      date: new Date(t.date),
      teacher: teacher.name,
      city: teacher.city,
      result: t.result,
    }));
  });
  await shareCsv(rows);
}
