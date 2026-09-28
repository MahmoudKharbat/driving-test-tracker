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
