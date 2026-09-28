/**
 * Assertions for the duplicate-teacher matcher.
 *
 * Cases marked [real] are taken verbatim from the tester's spreadsheet — they
 * are the defects the app exists to fix, so they are the ones that must not
 * regress. Run with: npm run test:names
 */

import {
  normalizeName,
  skeleton,
  nameSimilarity,
  findDuplicateCandidates,
  DUPLICATE_THRESHOLD,
} from '../src/lib/hebrewName.ts';

const CITIES = [
  'כפר סבא',
  'אריאל',
  'חדרה',
  'פתח תקווה',
  'נתניה',
  'הרצליה',
];

let passed = 0;
const failures: string[] = [];

function check(label: string, ok: boolean, detail: string) {
  if (ok) {
    passed++;
  } else {
    failures.push(`${label}\n      ${detail}`);
  }
}

/** These pairs are the same person and must be offered as duplicates. */
function same(label: string, a: string, b: string) {
  const score = nameSimilarity(a, b, CITIES);
  check(
    label,
    score >= DUPLICATE_THRESHOLD,
    `"${a}" vs "${b}" scored ${score.toFixed(3)}, need >= ${DUPLICATE_THRESHOLD}`,
  );
}

/** These are different people and must NOT be flagged as duplicates. */
function different(label: string, a: string, b: string) {
  const score = nameSimilarity(a, b, CITIES);
  check(
    label,
    score < DUPLICATE_THRESHOLD,
    `"${a}" vs "${b}" scored ${score.toFixed(3)}, need < ${DUPLICATE_THRESHOLD}`,
  );
}

function equals(label: string, actual: string, expected: string) {
  check(label, actual === expected, `got "${actual}", expected "${expected}"`);
}

console.log('\n  normalisation\n');

equals(
  '[real] strips appended city abbreviation',
  normalizeName('אור-כ.סבא', CITIES),
  'אור',
);
equals(
  '[real] strips appended full city name',
  normalizeName('דפוס יעקב(קובי)-נתניה', CITIES),
  'דפוס יעקב',
);
equals(
  'strips parenthetical nickname',
  normalizeName('יעקב(קובי)', CITIES),
  'יעקב',
);
equals(
  'unifies final letter forms',
  normalizeName('יוסף כהן', CITIES),
  'יוספ כהנ',
);
equals('collapses whitespace', normalizeName('  אור   פוגל  ', CITIES), 'אור פוגל');
equals(
  'strips quotes and gershayim without splitting the word',
  normalizeName('כ"ץ, משה', CITIES),
  'כצ משה',
);

// Regression: city stripping was a raw substring replace, so the short alias
// "כס" for כפר סבא chewed into unrelated surnames that merely contain those
// letters. Cities must only ever match whole tokens.
equals(
  'does not eat city letters out of the middle of a surname',
  normalizeName('יעקב כסלו', CITIES),
  'יעקב כסלו',
);
equals(
  'does not strip a city name embedded in a longer token',
  normalizeName('חדרתי משה', CITIES),
  'חדרתי משה',
);
equals(
  'still strips a city that stands as its own token',
  normalizeName('משה לוי כפר סבא', CITIES),
  'משה לוי',
);
equals(
  'leaves a name that is nothing but a city alone',
  normalizeName('נתניה', CITIES),
  'נתניה',
);

console.log('  skeleton\n');

equals(
  '[real] mater lectionis drops out (כתיב מלא vs חסר)',
  skeleton('דפוס'),
  skeleton('דפס'),
);
equals('homophones collapse (ט/ת)', skeleton('מטר'), skeleton('מתר'));
equals('homophones collapse (כ/ק)', skeleton('יצחק'), skeleton('יצחכ'));
equals('short name survives skeletonisation', skeleton('אור'), 'אר');

console.log('  duplicates that must be caught\n');

same(
  '[real] דפוס / דפס — the typo that split one person in two',
  'דפוס יעקב(קובי)-נתניה',
  'דפס יעקב(קובי)-נתניה',
);
same(
  '[real] first name only vs full name, same city suffix',
  'אור-כ.סבא',
  'אור פוגל-כ.סבא',
);
same(
  '[real] reversed name order, as shown in the spec prompt',
  'דפוס יעקב(קובי)-נתניה',
  'יעקב דפוס',
);
same('same name, one with city suffix', 'משה לוי', 'משה לוי-חדרה');
same('same name, differing whitespace', 'משה  לוי', 'משה לוי');
same('single dropped letter typo', 'אברהם', 'אברהמ');
same('trailing ה vs א drift', 'שלמה', 'שלמא');

console.log('  distinct people that must NOT be merged\n');

different('different surnames, shared first name', 'משה לוי', 'משה כהן');
different('unrelated names', 'אור פוגל', 'יעקב דפוס');
different('same surname, different first names', 'דוד מזרחי', 'שרה מזרחי');
different('short but distinct', 'רון', 'דן');

console.log('  candidate ranking\n');

{
  const existing = [
    { name: 'יעקב דפוס' },
    { name: 'משה לוי' },
    { name: 'אור פוגל' },
  ];
  const found = findDuplicateCandidates('דפס יעקב', existing, CITIES);
  check(
    'ranks the true duplicate first',
    found.length > 0 && found[0].teacher.name === 'יעקב דפוס',
    `got [${found.map((f) => `${f.teacher.name}:${f.score.toFixed(2)}`).join(', ')}]`,
  );
  check(
    'does not flag the unrelated teachers',
    found.length === 1,
    `expected exactly 1 candidate, got ${found.length}`,
  );
}

{
  const found = findDuplicateCandidates('ניר שמש', [{ name: 'משה לוי' }], CITIES);
  check(
    'returns nothing when there is no plausible match',
    found.length === 0,
    `got ${found.length} candidates`,
  );
}

console.log('');
if (failures.length) {
  console.error(`  ✗ ${failures.length} failed, ${passed} passed\n`);
  for (const f of failures) console.error(`    ✗ ${f}\n`);
  process.exit(1);
}
console.log(`  ✓ all ${passed} assertions passed\n`);
