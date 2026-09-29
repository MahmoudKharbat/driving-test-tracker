/**
 * Import of the examiner's original spreadsheet (the "מילוי תוצאות" tab:
 * date | city | teacher | pass/fail).
 *
 * The sheet has exactly the defects this app exists to fix, so the import
 * cleans rather than copies:
 *
 *   - Dates have no year and mixed separators: "5.6", "10,6". Typed as numbers,
 *     "10.10" is stored by the spreadsheet as 10.1 and reads as January.
 *   - The city is hand-appended to the teacher, a dozen ways: "-כ.סבא",
 *     "-כפר סבא", "עאמרכ.סבא" (glued), ".כ.סבא", "-- אריאל", "רפי הרצליה",
 *     "-הרצליה/אריאל", "-פ.ת".
 *   - Typos split one person: "דפוס/דפס יעקב(קובי)", "עומר/עמר בדיר".
 *   - Typos in the city column itself: "אראיל" for אריאל.
 *
 * Nothing here merges fuzzily. Names equal after normalisation are one teacher
 * (the same rule the add-teacher flow enforces); every near match becomes a
 * pair the examiner must decide before anything is written.
 *
 * Pure and free of the spreadsheet library, so scripts/test-import.mts can run
 * it under Node. Imports carry the .ts extension for that reason.
 */
import {
  CITY_ALIASES,
  DUPLICATE_THRESHOLD,
  nameSimilarity,
  normalizeName,
} from './hebrewName.ts';
import type { TestResult } from '../types.ts';

/** One spreadsheet cell as the reader hands it over. */
export type Cell = string | number | boolean | Date | null | undefined;

export interface SheetData {
  name: string;
  rows: Cell[][];
}

/* ── Locating the table ──────────────────────────────────────────────────── */

export interface TableLocation {
  sheet: string;
  headerRow: number;
  cols: { date: number; city: number; teacher: number; result: number };
}

const text = (c: Cell): string =>
  c instanceof Date ? '' : c === null || c === undefined ? '' : String(c).trim();

/**
 * Find the results table: the first sheet with a header row naming a date, a
 * city, a teacher and a result column. The other tabs (the teacher list, the
 * pivot) are ignored.
 */
export function findResultsTable(sheets: SheetData[]): TableLocation | null {
  for (const sheet of sheets) {
    for (let r = 0; r < Math.min(sheet.rows.length, 15); r++) {
      const cells = sheet.rows[r].map(text);
      const find = (test: (s: string) => boolean) => cells.findIndex(test);
      const cols = {
        date: find((s) => s.includes('תאריך')),
        city: find((s) => s === 'עיר' || s.startsWith('עיר')),
        teacher: find((s) => s.includes('מורה')),
        result: find((s) => s.includes('עבר') || s.includes('נכשל') || s.includes('תוצאה')),
      };
      if (Object.values(cols).every((i) => i >= 0)) {
        return { sheet: sheet.name, headerRow: r, cols };
      }
    }
  }
  return null;
}

/* ── Parsing rows ────────────────────────────────────────────────────────── */

export type SkipReason = 'date' | 'teacher' | 'city' | 'result';

export interface ParsedTest {
  /** 1-based spreadsheet row, for messages. */
  row: number;
  day: number;
  month: number;
  /** Only when the cell carried one (a real date cell or "5.6.2026"). */
  year?: number;
  rawCity: string;
  rawTeacher: string;
  result: TestResult;
}

export interface ParseResult {
  tests: ParsedTest[];
  skipped: { row: number; reason: SkipReason }[];
}

const DATE_TEXT = /^(\d{1,2})\s*[.,/\\-]\s*(\d{1,2})(?:\s*[.,/\\-]\s*(\d{2,4}))?$/;

function parseResult(cell: Cell): TestResult | null {
  const s = text(cell);
  if (s.startsWith('עבר')) return 'pass';
  if (s.startsWith('נכשל')) return 'fail';
  return null;
}

/**
 * Rows → tests. Fully empty rows are passed over silently (the sheet has
 * hundreds of blank template rows); a row with some cells but not a usable
 * test is reported as skipped.
 */
export function parseRows(sheet: SheetData, loc: TableLocation): ParseResult {
  const tests: ParsedTest[] = [];
  const skipped: ParseResult['skipped'] = [];
  let prevMonth: number | null = null;

  for (let r = loc.headerRow + 1; r < sheet.rows.length; r++) {
    const row = sheet.rows[r] ?? [];
    const cells = [row[loc.cols.date], row[loc.cols.city], row[loc.cols.teacher], row[loc.cols.result]];
    if (cells.every((c) => text(c) === '' && !(c instanceof Date))) continue;
    const rowNo = r + 1;

    const dateCell = row[loc.cols.date];
    let day: number;
    let month: number;
    let year: number | undefined;

    if (dateCell instanceof Date) {
      day = dateCell.getDate();
      month = dateCell.getMonth() + 1;
      year = dateCell.getFullYear();
    } else {
      const m = DATE_TEXT.exec(text(dateCell));
      if (!m) {
        skipped.push({ row: rowNo, reason: 'date' });
        continue;
      }
      day = Number(m[1]);
      month = Number(m[2]);
      if (m[3]) year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);

      // "10.10" typed into a number cell is stored as 10.1. The sheet runs in
      // date order, so a month-1 value straight after September or October is
      // October, not January. (After Nov/Dec a 1 really is January.)
      if (typeof dateCell === 'number' && month === 1 && (prevMonth === 9 || prevMonth === 10)) {
        month = 10;
      }
    }

    if (day < 1 || day > 31 || month < 1 || month > 12) {
      skipped.push({ row: rowNo, reason: 'date' });
      continue;
    }

    const rawCity = text(row[loc.cols.city]);
    const rawTeacher = text(row[loc.cols.teacher]);
    const result = parseResult(row[loc.cols.result]);
    if (!rawTeacher) {
      skipped.push({ row: rowNo, reason: 'teacher' });
      continue;
    }
    if (!rawCity) {
      skipped.push({ row: rowNo, reason: 'city' });
      continue;
    }
    if (!result) {
      skipped.push({ row: rowNo, reason: 'result' });
      continue;
    }

    prevMonth = month;
    tests.push({ row: rowNo, day, month, year, rawCity, rawTeacher, result });
  }

  return { tests, skipped };
}

/* ── Years ───────────────────────────────────────────────────────────────── */

export interface DatedTest extends ParsedTest {
  date: Date;
}

/**
 * Give yearless dates a year. The sheet is chronological, so the year starts
 * at `startYear` and advances whenever the month jumps backwards by more than
 * half a year (December → January). Impossible dates ("31.6") are dropped.
 */
export function assignYears(
  tests: ParsedTest[],
  startYear: number,
): { dated: DatedTest[]; invalid: number[] } {
  const dated: DatedTest[] = [];
  const invalid: number[] = [];
  let year = startYear;
  let prev: number | null = null;

  for (const t of tests) {
    let y = t.year;
    if (y === undefined) {
      if (prev !== null && t.month < prev - 6) year++;
      prev = t.month;
      y = year;
    }
    const date = new Date(y, t.month - 1, t.day);
    if (date.getMonth() !== t.month - 1) {
      invalid.push(t.row);
      continue;
    }
    dated.push({ ...t, date });
  }
  return { dated, invalid };
}

/** The latest start year that keeps every test on or before today. */
export function defaultStartYear(tests: ParsedTest[], today: Date): number {
  let year = today.getFullYear();
  for (let i = 0; i < 3; i++) {
    const { dated } = assignYears(tests, year);
    const last = dated.reduce((max, t) => Math.max(max, t.date.getTime()), 0);
    if (last <= today.getTime()) return year;
    year--;
  }
  return year;
}

/* ── Names and cities ────────────────────────────────────────────────────── */

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** An alias as a pattern: dots may be followed by a space ("פ. תקווה"), words
 *  by any run of spaces. */
const aliasPattern = (alias: string) =>
  escape(alias).replace(/\\\./g, '\\.\\s*').replace(/\s+/g, '\\s+');

/**
 * Remove an appended city from a teacher name, keeping the rest exactly as
 * written ("דפוס יעקב(קובי)-נתניה" → "דפוס יעקב(קובי)").
 *
 * Unlike normalizeName, which is lossy and only for comparison, this is what
 * gets stored and shown. A city is removed only at the end of the name, after
 * a separator — or glued on, for dotted abbreviations like "כ.סבא", which do not
 * occur inside real names. A name that would be left empty is kept whole.
 */
export function cleanTeacherName(raw: string, cities: string[]): string {
  let name = raw.replace(/\s+/g, ' ').trim();
  // Stray marks the examiner used as notes: "חן נדב-כ.סבא!@!!".
  name = name.replace(/[\s!@#*]+$/, '');

  const names = new Set<string>(['אראיל', 'פ.ת']);
  for (const c of cities) names.add(c);
  for (const [city, aliases] of Object.entries(CITY_ALIASES)) {
    names.add(city);
    aliases.forEach((a) => names.add(a));
  }
  const sorted = [...names].sort((a, b) => b.length - a.length);
  const any = sorted.map(aliasPattern).join('|');
  const dotted = sorted.filter((a) => a.includes('.')).map(aliasPattern).join('|');

  const suffix = new RegExp(
    `(?:[\\s\\-–—.]+(?:${any})|(?:${dotted}))(?:\\s*/\\s*(?:${any}))*$`,
  );
  const stripped = name.replace(suffix, '').replace(/[\s\-–—.]+$/, '').trim();
  return stripped.length >= 2 ? stripped : name;
}

/**
 * The city to file a spreadsheet city under.
 *
 * An exact known city wins. Otherwise, if most of that city's teachers carry a
 * spelled-out city suffix that differs from the column ("אראיל" rows whose
 * names end "-אריאל"), the suffix is the better spelling. Else the column value
 * as written. Always shown to the examiner, who can change it.
 */
export function suggestCity(rawCity: string, teacherNames: string[], knownCities: string[]): string {
  const city = rawCity.replace(/\s+/g, ' ').trim();
  if (knownCities.includes(city)) return city;

  const counts = new Map<string, number>();
  for (const n of teacherNames) {
    const m = /[-–—]\s*([^\-–—.]+?)\s*$/.exec(n);
    const s = m?.[1]?.trim();
    if (s && s !== city && !s.includes('/')) counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  const [best, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['', 0];
  if (best && n >= teacherNames.length / 2) {
    return knownCities.find((k) => k === best) ?? best;
  }
  return city;
}

/* ── The plan ────────────────────────────────────────────────────────────── */

export interface ExistingTeacher {
  id: string;
  name: string;
  city: string;
}

/** A teacher as the import sees it: one spelling group within one city. */
export interface ImportGroup {
  key: string;
  city: string;
  name: string;
  count: number;
  /** Set when an app teacher in the same city has the same normalised name. */
  existingId?: string;
}

/** Two names close enough that only the examiner can say if they are one. */
export interface ImportPair {
  id: string;
  city: string;
  a: { key: string; name: string; count: number; existing: boolean };
  b: { key: string; name: string; count: number; existing: boolean };
}

export type PairDecision = 'same' | 'different';

export interface ImportPlan {
  groups: ImportGroup[];
  pairs: ImportPair[];
  undecided: number;
  /** What to write, once every pair is decided. */
  newCities: string[];
  teachers: { tempId: string; name: string; city: string; existingId?: string }[];
  tests: { tempId: string; date: Date; result: TestResult }[];
}

export function buildPlan(input: {
  tests: DatedTest[];
  /** Spreadsheet city → the city to file it under. */
  cityMap: Record<string, string>;
  existing: ExistingTeacher[];
  knownCities: string[];
  decisions: Record<string, PairDecision>;
}): ImportPlan {
  const { tests, cityMap, existing, knownCities, decisions } = input;
  const allCities = [...new Set([...knownCities, ...Object.values(cityMap)])];
  const norm = (n: string) => normalizeName(n, allCities);

  // 1. Group by city + normalised name: identical after normalisation is one
  //    teacher. The display name is the most frequent spelling.
  const groups = new Map<string, ImportGroup & { spellings: Map<string, number> }>();
  const testKeys: string[] = [];
  for (const t of tests) {
    const city = cityMap[t.rawCity] ?? t.rawCity;
    const name = cleanTeacherName(t.rawTeacher, allCities);
    const key = `${city}\u0000${norm(name) || name}`;
    let g = groups.get(key);
    if (!g) {
      g = { key, city, name, count: 0, spellings: new Map() };
      groups.set(key, g);
    }
    g.count++;
    g.spellings.set(name, (g.spellings.get(name) ?? 0) + 1);
    testKeys.push(key);
  }
  for (const g of groups.values()) {
    g.name = [...g.spellings.entries()].sort(
      (a, b) => b[1] - a[1] || b[0].length - a[0].length,
    )[0][0];
    const match = existing.find((e) => e.city === g.city && norm(e.name) === norm(g.name));
    if (match) g.existingId = match.id;
  }

  // 2. Near matches within a city — between two imported groups, or an
  //    imported group and an app teacher. Never between two app teachers.
  const existingKey = (id: string) => `existing\u0000${id}`;
  const pairs: ImportPair[] = [];
  const list = [...groups.values()];
  for (const city of new Set(list.map((g) => g.city))) {
    const inCity = list.filter((g) => g.city === city).sort((a, b) => b.count - a.count);
    const appInCity = existing.filter(
      (e) => e.city === city && !inCity.some((g) => g.existingId === e.id),
    );
    for (let i = 0; i < inCity.length; i++) {
      const g = inCity[i];
      const others = [
        ...inCity.slice(0, i).map((o) => ({ key: o.key, name: o.name, count: o.count, existing: Boolean(o.existingId) })),
        ...appInCity.map((e) => ({ key: existingKey(e.id), name: e.name, count: 0, existing: true })),
      ];
      for (const o of others) {
        if (nameSimilarity(g.name, o.name, allCities) < DUPLICATE_THRESHOLD) continue;
        const [a, b] = [o, { key: g.key, name: g.name, count: g.count, existing: Boolean(g.existingId) }];
        pairs.push({ id: `${a.key}\u0001${b.key}`, city, a, b });
      }
    }
  }

  // 3. Apply "same" decisions (union-find). The survivor is an app teacher if
  //    one is involved, else the group with more tests.
  const parent = new Map<string, string>();
  const find = (k: string): string => {
    const p = parent.get(k);
    if (!p || p === k) return k;
    const root = find(p);
    parent.set(k, root);
    return root;
  };
  const weight = (k: string) =>
    k.startsWith('existing\u0000') ? Infinity : (groups.get(k)?.count ?? 0);
  for (const p of pairs) {
    if (decisions[p.id] !== 'same') continue;
    const ra = find(p.a.key);
    const rb = find(p.b.key);
    if (ra === rb) continue;
    if (weight(rb) > weight(ra)) parent.set(ra, rb);
    else parent.set(rb, ra);
  }

  // 4. What to write.
  const teachers = new Map<string, ImportPlan['teachers'][number]>();
  const rootOf = (key: string) => {
    const root = find(key);
    if (!teachers.has(root)) {
      if (root.startsWith('existing\u0000')) {
        const e = existing.find((x) => existingKey(x.id) === root)!;
        teachers.set(root, { tempId: root, name: e.name, city: e.city, existingId: e.id });
      } else {
        const g = groups.get(root)!;
        teachers.set(root, { tempId: root, name: g.name, city: g.city, existingId: g.existingId });
      }
    }
    return root;
  };
  const planTests = tests.map((t, i) => ({
    tempId: rootOf(testKeys[i]),
    date: t.date,
    result: t.result,
  }));

  const newCities = [...new Set(list.map((g) => g.city))].filter((c) => !knownCities.includes(c));

  return {
    groups: list.map(({ spellings: _s, ...g }) => g),
    pairs,
    undecided: pairs.filter((p) => !decisions[p.id]).length,
    newCities,
    teachers: [...teachers.values()],
    tests: planTests,
  };
}
