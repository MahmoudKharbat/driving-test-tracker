import type { TeacherSort, TeacherWithStats } from '../types';
import { normalizeName } from './hebrewName';

/**
 * Pure list helpers, kept free of Firestore imports so the mock data layer
 * (src/mock/data.ts) can share them with the real one.
 */

/** Pass rate as a whole-number percentage; 0 when no tests are recorded. */
export function passRate(passed: number, total: number): number {
  return total > 0 ? Math.round((passed / total) * 100) : 0;
}

/**
 * Apply the search box, the city filter, the sort selector and its direction.
 *
 * Search runs over the normalised name, so a query typed without the
 * punctuation or city suffix that happens to be stored in the record still
 * finds it.
 *
 * Each sort has a natural direction — most tests first, lowest pass rate first,
 * newest first, א→ת — and `reversed` flips only that key. Teachers with no
 * tests stay last either way (they have no rate or date to order by), and ties
 * always fall back to name, א→ת.
 */
export function filterAndSortTeachers(
  teachers: TeacherWithStats[],
  opts: {
    search: string;
    city: string | null;
    sort: TeacherSort;
    cities: string[];
    reversed?: boolean;
  },
): TeacherWithStats[] {
  const needle = normalizeName(opts.search, opts.cities);
  const dir = opts.reversed ? -1 : 1;

  const filtered = teachers.filter((t) => {
    if (opts.city && t.city !== opts.city) return false;
    if (!needle) return true;
    return normalizeName(t.name, opts.cities).includes(needle);
  });

  const byName = (a: TeacherWithStats, b: TeacherWithStats) =>
    a.name.localeCompare(b.name, 'he');

  /** Untested teachers last regardless of direction; 0 when both are tested. */
  const untestedLast = (a: TeacherWithStats, b: TeacherWithStats) =>
    (a.total === 0 ? 1 : 0) - (b.total === 0 ? 1 : 0);

  return [...filtered].sort((a, b) => {
    switch (opts.sort) {
      case 'mostTests':
        return dir * (b.total - a.total) || byName(a, b);
      case 'lowestPassRate':
        return (
          untestedLast(a, b) ||
          dir * (passRate(a.passed, a.total) - passRate(b.passed, b.total)) ||
          byName(a, b)
        );
      case 'recentlyTested': {
        const at = a.lastTestedAt?.toMillis();
        const bt = b.lastTestedAt?.toMillis();
        if (at === undefined || bt === undefined) {
          return (at === undefined ? 1 : 0) - (bt === undefined ? 1 : 0) || byName(a, b);
        }
        return dir * (bt - at) || byName(a, b);
      }
      case 'name':
      default:
        return dir * byName(a, b);
    }
  });
}
