/**
 * City list helpers, free of Firestore imports so the mock data layer shares
 * them.
 *
 * The list the app shows is the seeded `config/cities` followed by the cities
 * this tester added himself (`testers/{uid}/settings/cities`). The seeded list
 * stays admin-only; additions live in the tester's own subtree so one tester can
 * never change another's dropdown.
 */

/** Trim and collapse inner whitespace, so "פתח  תקווה " matches "פתח תקווה". */
export function normalizeCityName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

/** Seeded cities first, in their configured order, then the tester's own. */
export function mergeCities(seeded: string[], custom: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const city of [...seeded, ...custom]) {
    const name = normalizeCityName(city);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}
