/**
 * Assertions for the spreadsheet import, pinned to rows from the examiner's real
 * sheet ("סיכום תוצאות מבחני נהיגה — מילוי תוצאות").
 *
 *   npm run test:import
 */
import {
  assignYears,
  buildPlan,
  cleanTeacherName,
  defaultStartYear,
  findResultsTable,
  parseRows,
  suggestCity,
  type SheetData,
} from '../src/lib/importSheet.ts';

// A tiny assert, so the typecheck needs no Node type definitions.
const assert = {
  ok(cond: unknown, msg = 'expected truthy'): void {
    if (!cond) throw new Error(msg);
  },
  equal(a: unknown, b: unknown) {
    if (a !== b) throw new Error(`got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
  },
  deepEqual(a: unknown, b: unknown) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      throw new Error(`got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
    }
  },
};

let passed = 0;
const failures: string[] = [];
function check(label: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${label}`);
  } catch (e) {
    failures.push(`${label}: ${(e as Error).message}`);
    console.log(`  ✗ ${label}`);
  }
}

const CITIES = ['כפר סבא', 'אריאל', 'חדרה', 'פתח תקווה', 'נתניה', 'הרצליה'];

console.log('cleanTeacherName — every suffix style in the sheet');
const names: [string, string][] = [
  ['אלקחי אביאל-כ.סבא', 'אלקחי אביאל'],
  ['מנסוור דיב-כפר סבא', 'מנסוור דיב'],
  ['אלחאדי עאמרכ.סבא', 'אלחאדי עאמר'],
  ['אבו עטיה אחמד.כ.סבא', 'אבו עטיה אחמד'],
  ['יהודה-- אריאל', 'יהודה'],
  ['רפי הרצליה', 'רפי'],
  ['נביל חדרה', 'נביל'],
  ['איציק פתח תקווה', 'איציק'],
  ['אביחי נהרי-הרצליה/אריאל', 'אביחי נהרי'],
  ['סגל שמעון-פ.ת', 'סגל שמעון'],
  ['אריק-פ. תקווה', 'אריק'],
  ['גאבר עדנאן -כ.סבא', 'גאבר עדנאן'],
  ['שרון כתבי- נתניה', 'שרון כתבי'],
  ['דפוס יעקב(קובי)-נתניה', 'דפוס יעקב(קובי)'],
  ['חן נדב-כ.סבא!@!!', 'חן נדב'],
  ['עבד אלכרים גיוסי', 'עבד אלכרים גיוסי'],
  ['חביב אללה וסאם', 'חביב אללה וסאם'],
  ['יואל"יוסי כהן" - אריאל', 'יואל"יוסי כהן"'],
  ['סיף סייף-כפר  סבא', 'סיף סייף'],
];
for (const [raw, want] of names) {
  check(`${raw} → ${want}`, () => assert.equal(cleanTeacherName(raw, CITIES), want));
}

console.log('dates');
const sheet: SheetData = {
  name: 'מילוי תוצאות',
  rows: [
    ['תאריך בחינה', 'עיר', 'שם מורה', 'עבר/נכשל'],
    [5.6, 'כפר סבא', 'אלקחי אביאל-כ.סבא', 'נכשל'],
    ['5,6', 'כפר סבא', 'קאופמן יצחק-כ.סבא', 'נכשל'],
    ['10,6', 'אראיל', 'ערן הרקוביץ-אריאל', 'עבר'],
    ['10,6', 'אראיל', 'ערן הרקוביץ-אריאל', 'נכשל'],
    [16.7, 'נתניה', 'דפוס יעקב(קובי)-נתניה', 'נכשל'],
    [2.8, 'נתניה', 'דפס יעקב(קובי)-נתניה', 'עבר'],
    [28.9, 'אראיל', 'אלכס-אריאל', 'עבר'],
    [5.1, 'אראיל', 'אלכס-אריאל', 'נכשל'], // "5.10" stored as a number
    ['', '', '', ''],
    ['31.6', 'חדרה', 'רז שני-חדרה', 'נכשל'],
    ['12.7', 'כפר סבא', 'בדר-כ.סבא', ''],
  ],
};

const loc = findResultsTable([{ name: 'נתונים', rows: [['ערים', 'מורים']] }, sheet]);
check('finds the results tab, not the teacher list', () => {
  assert.equal(loc?.sheet, 'מילוי תוצאות');
});
if (!loc) throw new Error('results table not found; later checks depend on it');

const parsed = parseRows(sheet, loc);
check('"5.6" (number) and "5,6" (text) both read as 5 June', () => {
  assert.deepEqual([parsed.tests[0].day, parsed.tests[0].month], [5, 6]);
  assert.deepEqual([parsed.tests[1].day, parsed.tests[1].month], [5, 6]);
});
check('numeric 5.1 after September is 5 October', () => {
  const t = parsed.tests.find((x) => x.row === 9)!;
  assert.deepEqual([t.day, t.month], [5, 10]);
});
check('blank rows ignored; a row with no result is reported', () => {
  assert.deepEqual(parsed.skipped, [{ row: 12, reason: 'result' }]);
});

const today = new Date(2026, 8, 29);
const year = defaultStartYear(parsed.tests, today);
const { dated, invalid } = assignYears(parsed.tests, year);
check('year chosen so no test is in the future', () => {
  assert.equal(year, 2025); // 5 Oct 2026 would be after 29 Sep 2026
});
check('31 June is rejected, not rolled into July', () => {
  assert.deepEqual(invalid, [11]);
});

console.log('cities');
check('"אראיל" rows suggest אריאל, from the teachers\' suffix', () => {
  const teachers = parsed.tests.filter((t) => t.rawCity === 'אראיל').map((t) => t.rawTeacher);
  assert.equal(suggestCity('אראיל', teachers, []), 'אריאל');
});
check('an abbreviation suffix does not override the column', () => {
  assert.equal(suggestCity('כפר סבא', ['בדר-כ.סבא', 'אור-כ.סבא'], []), 'כפר סבא');
});

console.log('plan');
const cityMap = { 'כפר סבא': 'כפר סבא', אראיל: 'אריאל', נתניה: 'נתניה', חדרה: 'חדרה' };
const plan = buildPlan({ tests: dated, cityMap, existing: [], knownCities: [], decisions: {} });
check('identical spellings are one teacher', () => {
  const eran = plan.groups.filter((g) => g.name === 'ערן הרקוביץ');
  assert.equal(eran.length, 1);
  assert.equal(eran[0].count, 2);
  assert.equal(eran[0].city, 'אריאל');
});
check('דפוס/דפס is asked, not merged', () => {
  assert.equal(plan.pairs.length, 1);
  assert.equal(plan.undecided, 1);
  assert.equal(new Set(plan.tests.map((t) => t.tempId)).size, plan.groups.length);
});
check('"same" merges into the one with more tests; "different" keeps both', () => {
  const id = plan.pairs[0].id;
  const same = buildPlan({ tests: dated, cityMap, existing: [], knownCities: [], decisions: { [id]: 'same' } });
  assert.equal(same.undecided, 0);
  assert.equal(same.teachers.filter((t) => t.city === 'נתניה').length, 1);
  const diff = buildPlan({ tests: dated, cityMap, existing: [], knownCities: [], decisions: { [id]: 'different' } });
  assert.equal(diff.teachers.filter((t) => t.city === 'נתניה').length, 2);
});
check('an app teacher with the same name is reused, not duplicated', () => {
  const p = buildPlan({
    tests: dated,
    cityMap,
    existing: [{ id: 'T1', name: 'אלכס', city: 'אריאל' }],
    knownCities: ['אריאל'],
    decisions: {},
  });
  assert.equal(p.teachers.find((t) => t.name === 'אלכס')?.existingId, 'T1');
  assert.ok(!p.newCities.includes('אריאל'));
});
check('no teacher name keeps a city', () => {
  for (const t of plan.teachers) assert.ok(!/כ\.סבא|נתניה|אריאל|חדרה/.test(t.name), t.name);
});

console.log('');
if (failures.length) {
  console.error(`  ✗ ${failures.length} failed, ${passed} passed\n`);
  for (const f of failures) console.error(`    ✗ ${f}\n`);
  process.exit(1);
}
console.log(`  ✓ all ${passed} assertions passed\n`);
