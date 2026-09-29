import type { Timestamp } from '@react-native-firebase/firestore';

import type { MonthStats, TeacherWithStats } from '../types';

/**
 * The summary list's time filter: everything, one calendar year, or one month.
 *
 * Works on each teacher's `byMonth` buckets (maintained by the Cloud Function in
 * the Firebase build, derived on the device in the phone-only one), so filtering
 * never reads individual tests.
 */

export type Period = 'all' | `y:${number}` | `m:${string}`;

/** "2026-09" in the phone's local time — test dates are local midnights. */
export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function inPeriod(key: string, period: Period): boolean {
  if (period === 'all') return true;
  if (period.startsWith('y:')) return key.startsWith(period.slice(2) + '-');
  return key === period.slice(2);
}

/**
 * Teachers re-counted for the period. Outside 'all', teachers with no tests in
 * the period are dropped — the question is "who did I test then".
 */
export function applyPeriod(
  teachers: TeacherWithStats[],
  period: Period,
): TeacherWithStats[] {
  if (period === 'all') return teachers;

  const out: TeacherWithStats[] = [];
  for (const t of teachers) {
    let passed = 0;
    let failed = 0;
    let last: Timestamp | null = null;
    for (const [key, m] of Object.entries(t.byMonth) as [string, MonthStats][]) {
      if (!inPeriod(key, period)) continue;
      passed += m.passed;
      failed += m.failed;
      if (!last || m.lastTestedAt.toMillis() > last.toMillis()) last = m.lastTestedAt;
    }
    if (passed + failed === 0) continue;
    out.push({ ...t, passed, failed, total: passed + failed, lastTestedAt: last });
  }
  return out;
}

/**
 * Menu options, newest first: all, then for each year with tests the whole
 * year followed by its months.
 */
export function periodOptions(teachers: TeacherWithStats[]): Period[] {
  const months = new Set<string>();
  for (const t of teachers) for (const key of Object.keys(t.byMonth)) months.add(key);

  const sorted = [...months].sort().reverse();
  const out: Period[] = ['all'];
  let year = '';
  for (const key of sorted) {
    const y = key.slice(0, 4);
    if (y !== year) {
      year = y;
      out.push(`y:${Number(y)}`);
    }
    out.push(`m:${key}`);
  }
  return out;
}

const MONTH_NAME = new Intl.DateTimeFormat('he-IL', { month: 'long' });

/** "ספטמבר 2026" / "2026" / the caller's label for all. */
export function periodLabel(period: Period, allLabel: string): string {
  if (period === 'all') return allLabel;
  if (period.startsWith('y:')) return period.slice(2);
  const [y, m] = period.slice(2).split('-').map(Number);
  return `${MONTH_NAME.format(new Date(y, m - 1, 1))} ${y}`;
}
