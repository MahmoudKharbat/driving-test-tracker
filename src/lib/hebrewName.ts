/**
 * Hebrew name normalisation and fuzzy matching.
 *
 * This module exists to fix the central defect in the source spreadsheet: the
 * teacher was a free-text string, so one real person could occupy several rows
 * and silently split his counts. Two failure modes appear in the real data:
 *
 *   1. City hand-appended to the name, inconsistently:
 *        "אור-כ.סבא"  vs  "אור פוגל-כ.סבא"
 *   2. Spelling drift between כתיב מלא and כתיב חסר, i.e. a dropped mater
 *      lectionis, which reads as an ordinary typo:
 *        "דפוס יעקב(קובי)-נתניה"  vs  "דפס יעקב(קובי)-נתניה"
 *
 * Name order also varies ("דפוס יעקב" vs "יעקב דפוס"), so comparison must be
 * order-insensitive.
 *
 * The approach is two-layer:
 *
 *   normalise  — strip what is never meaningful: diacritics, punctuation,
 *                parenthetical nicknames, an appended city, whitespace noise.
 *                Preserves the letters, so it is safe to display.
 *
 *   skeleton   — collapse what is *sometimes* meaningful: matres lectionis
 *                (ו/י/א/ה) and letters that are homophones in Israeli Hebrew
 *                (ט/ת, כ/ק/ח, ס/שׂ, א/ע). Lossy and never displayed; used only
 *                to decide that two spellings are probably the same word.
 *
 * Nothing here auto-merges. Every candidate is surfaced to the user to confirm,
 * because "אור" and "אור פוגל" genuinely may be two different people and only
 * he knows which.
 */

/** Hebrew points, cantillation and the maqaf: U+0591–U+05C7. */
const DIACRITICS = /[֑-ׇ]/g;

/**
 * Geresh, gershayim and quotes mark abbreviations *inside* a word — כ"ץ is one
 * name, not two. They are deleted, not replaced with a space.
 */
const ABBREVIATION_MARKS = /['"״׳`]/g;

/** Dashes, dots, commas and slashes separate tokens; they become spaces. */
const SEPARATORS = /[־–—\-.,|/\\_+*&=:;!?]/g;

/** Nicknames in brackets: "יעקב(קובי)" → "יעקב". Not a distinguishing feature. */
const PARENTHETICAL = /[([{][^)\]}]*[)\]}]?/g;

const FINAL_FORMS: Record<string, string> = {
  ך: 'כ',
  ם: 'מ',
  ן: 'נ',
  ף: 'פ',
  ץ: 'צ',
};

/**
 * Letters that sound alike in Israeli Hebrew and are therefore interchanged by
 * a fast typist. Each class collapses to one representative.
 */
const HOMOPHONES: Record<string, string> = {
  ט: 'ת',
  ק: 'כ',
  ח: 'כ',
  ע: 'א',
  ש: 'ס',
  ב: 'ב',
};

/**
 * Common written abbreviations for the six cities in use. The tester types
 * these into the name field; they carry no identity information and must not
 * influence a match.
 */
export const CITY_ALIASES: Record<string, string[]> = {
  'כפר סבא': ['כ.סבא', 'כ סבא', 'כפ סבא', 'כ"ס', 'כס'],
  'פתח תקווה': ['פ.תקווה', 'פ תקווה', 'פ.ת', 'פתח תקוה', 'פ"ת'],
  נתניה: ['נתניא'],
  חדרה: [],
  אריאל: [],
  הרצליה: ['הרצליא'],
};

/** Every city string worth stripping, as token sequences, longest first so
 *  "כפר סבא" is tried before the single token "כס". */
function cityTokenSequences(cities: string[], clean: (s: string) => string): string[][] {
  const all = new Set<string>();
  for (const city of cities) {
    all.add(city);
    for (const alias of CITY_ALIASES[city] ?? []) all.add(alias);
  }
  // Aliases for cities not in the passed list still deserve stripping — the
  // config document is editable and may drift from this table.
  for (const [city, aliases] of Object.entries(CITY_ALIASES)) {
    all.add(city);
    for (const alias of aliases) all.add(alias);
  }
  return [...all]
    .map((c) => clean(c).split(' ').filter(Boolean))
    .filter((seq) => seq.length > 0)
    .sort((a, b) => b.length - a.length || b.join('').length - a.join('').length);
}

/**
 * Remove city token sequences, matching whole tokens only.
 *
 * Whole-token matching is the point: a plain substring replace would let the
 * short alias "כס" eat into unrelated surnames such as "כסלו", quietly
 * destroying part of a real name.
 *
 * A name consisting of nothing but a city is left untouched — better to keep a
 * useless-looking name than to normalise it to the empty string.
 */
function stripCityTokens(tokens: string[], sequences: string[][]): string[] {
  let out = [...tokens];
  for (const seq of sequences) {
    for (let i = 0; i + seq.length <= out.length; i++) {
      if (seq.every((tok, k) => out[i + k] === tok)) {
        const candidate = [...out.slice(0, i), ...out.slice(i + seq.length)];
        if (candidate.length === 0) continue;
        out = candidate;
        i--;
      }
    }
  }
  return out;
}

/**
 * Reduce a raw name to comparable form while keeping it readable.
 *
 * @param raw    the name as typed
 * @param cities city list from `config/cities`, so an added city starts being
 *               stripped without an app release
 */
export function normalizeName(raw: string, cities: string[] = []): string {
  // Punctuation, casing and letter-form cleanup, applied identically to the
  // name and to the city aliases so the two are comparable token by token.
  const clean = (input: string): string => {
    let s = (input ?? '').normalize('NFKD').replace(DIACRITICS, '');
    s = s.replace(PARENTHETICAL, ' ');
    s = s.replace(ABBREVIATION_MARKS, '');
    s = s.replace(SEPARATORS, ' ');
    s = [...s].map((ch) => FINAL_FORMS[ch] ?? ch).join('');
    return s.replace(/\s+/g, ' ').trim();
  };

  const tokens = clean(raw).split(' ').filter(Boolean);
  return stripCityTokens(tokens, cityTokenSequences(cities, clean)).join(' ');
}

/**
 * Lossy consonantal skeleton. Never shown to the user.
 *
 * Drops matres lectionis so כתיב מלא and כתיב חסר converge — this is what makes
 * "דפוס" and "דפס" compare equal — then collapses homophone classes.
 */
export function skeleton(token: string): string {
  let s = [...token]
    .map((ch) => FINAL_FORMS[ch] ?? ch)
    .map((ch) => HOMOPHONES[ch] ?? ch)
    .join('');

  // Remove vowel-letters everywhere except as the sole opening consonant, where
  // dropping them would erase a short name entirely ("אור" → "ר").
  const head = s.slice(0, 1);
  const tail = s.slice(1).replace(/[ויאה]/g, '');
  s = head + tail;

  // "ממ" → "מ": doubled letters are a typing artefact, not a distinction.
  s = s.replace(/(.)\1+/g, '$1');

  return s;
}

function tokens(normalized: string): string[] {
  return normalized.split(' ').filter(Boolean);
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = [...curr];
  }
  return prev[b.length];
}

function ratio(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - levenshtein(a, b) / max;
}

/**
 * Similarity of two raw names in 0..1.
 *
 * Order-insensitive: tokens are matched greedily best-first, so "דפוס יעקב"
 * and "יעקב דפוס" score as identical.
 *
 * Leftover tokens on either side are penalised but not fatal, which is what
 * puts "אור" against "אור פוגל" in the "ask the user" band rather than either
 * silently merging them or silently creating a duplicate.
 */
export function nameSimilarity(
  a: string,
  b: string,
  cities: string[] = [],
): number {
  const na = normalizeName(a, cities);
  const nb = normalizeName(b, cities);

  if (!na || !nb) return 0;
  if (na === nb) return 1;

  const ta = tokens(na);
  const tb = tokens(nb);

  const sa = ta.map(skeleton);
  const sb = tb.map(skeleton);

  // Same words in any order, modulo spelling drift.
  const key = (xs: string[]) => [...xs].sort().join('|');
  if (key(sa) === key(sb)) return 0.97;

  // Greedy best-first pairing over the skeletons.
  const short = sa.length <= sb.length ? sa : sb;
  const long = sa.length <= sb.length ? sb : sa;
  const used = new Set<number>();
  let matched = 0;

  for (const token of short) {
    let bestScore = 0;
    let bestIdx = -1;
    for (let i = 0; i < long.length; i++) {
      if (used.has(i)) continue;
      const score = ratio(token, long[i]);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    // Below this a "match" is noise rather than a typo.
    if (bestIdx >= 0 && bestScore >= 0.6) {
      used.add(bestIdx);
      matched += bestScore;
    }
  }

  const paired = matched / short.length;
  // Every unmatched token in the longer name is evidence they are different
  // people, weighted so one extra surname still lands in the confirm band.
  const coverage = short.length / long.length;

  return paired * (0.72 + 0.28 * coverage);
}

/**
 * Scores at or above this are shown to the user as "did you mean…?".
 *
 * Tuned against the real defects: the דפוס/דפס pair and the אור/אור פוגל pair
 * must both surface, while unrelated names in the same city must not.
 */
export const DUPLICATE_THRESHOLD = 0.8;

export interface DuplicateCandidate<T> {
  teacher: T;
  score: number;
}

/**
 * Rank existing teachers against a name the user is about to create.
 *
 * Callers must pass only teachers in the selected city — the same person is
 * not expected across cities, and cross-city noise would dilute the ranking.
 */
export function findDuplicateCandidates<T extends { name: string }>(
  candidateName: string,
  existing: T[],
  cities: string[] = [],
  threshold: number = DUPLICATE_THRESHOLD,
): DuplicateCandidate<T>[] {
  return existing
    .map((teacher) => ({
      teacher,
      score: nameSimilarity(candidateName, teacher.name, cities),
    }))
    .filter((c) => c.score >= threshold)
    .sort((a, b) => b.score - a.score);
}
