import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useUid } from '../../src/backend/auth';
import { importBatch, useCities, useTeachers } from '../../src/backend/data';
import { strings } from '../../src/strings';
import { colors, fontSize, radius, spacing } from '../../src/theme';
import { AppText, Button } from '../../src/components/ui';
import { CheckIcon, CloseIcon } from '../../src/components/icons';
import { formatShortDate } from '../../src/lib/date';
import { normalizeCityName } from '../../src/lib/cities';
import {
  assignYears,
  buildPlan,
  defaultStartYear,
  findResultsTable,
  parseRows,
  suggestCity,
  type ImportPair,
  type PairDecision,
  type ParseResult,
} from '../../src/lib/importSheet';
import { pickSpreadsheet } from '../../src/lib/readWorkbook';
import type { ImportResult } from '../../src/types';

type Stage =
  | { kind: 'pick'; error?: string }
  | { kind: 'reading' }
  | { kind: 'review'; fileName: string; parsed: ParseResult }
  | { kind: 'done'; result: ImportResult };

/**
 * Import the old spreadsheet.
 *
 * Pick → review → import. The review is where the sheet's defects are dealt
 * with in the open: the year the file never recorded, city spellings, and every
 * pair of teacher names close enough to be one person. The import button stays
 * disabled until each pair has an answer — nothing is merged on a guess, and
 * nothing is split on one either.
 */
export default function ImportScreen() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>({ kind: 'pick' });

  const pick = async () => {
    setStage({ kind: 'reading' });
    try {
      const file = await pickSpreadsheet();
      if (!file) {
        setStage({ kind: 'pick' });
        return;
      }
      const loc = findResultsTable(file.sheets);
      const sheet = loc && file.sheets.find((s) => s.name === loc.sheet);
      if (!loc || !sheet) {
        setStage({ kind: 'pick', error: strings.importSheet.noTable });
        return;
      }
      const parsed = parseRows(sheet, loc);
      if (parsed.tests.length === 0) {
        setStage({ kind: 'pick', error: strings.importSheet.noTable });
        return;
      }
      setStage({ kind: 'review', fileName: file.fileName, parsed });
    } catch {
      setStage({ kind: 'pick', error: strings.importSheet.readFailed });
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.grabber} />
      <View style={styles.header}>
        <AppText size="lg" weight="bold" style={styles.flex}>
          {strings.importSheet.title}
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={strings.common.close}
          onPress={() => router.back()}
          style={styles.close}
        >
          <CloseIcon size={20} color={colors.textMuted} />
        </Pressable>
      </View>

      {stage.kind === 'pick' ? (
        <View style={styles.pad}>
          <AppText size="md" color={colors.textMuted}>
            {strings.importSheet.intro}
          </AppText>
          <AppText size="sm" color={colors.textFaint}>
            {strings.importSheet.introSheets}
          </AppText>
          {stage.error ? (
            <View style={styles.error}>
              <AppText size="sm" color={colors.fail}>
                {stage.error}
              </AppText>
            </View>
          ) : null}
          <Button label={strings.importSheet.pick} onPress={pick} />
        </View>
      ) : stage.kind === 'reading' ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
          <AppText size="sm" color={colors.textMuted} align="center">
            {strings.importSheet.reading}
          </AppText>
        </View>
      ) : stage.kind === 'review' ? (
        <Review
          fileName={stage.fileName}
          parsed={stage.parsed}
          onDone={(result) => setStage({ kind: 'done', result })}
        />
      ) : (
        <View style={styles.pad}>
          <View style={styles.doneRow}>
            <CheckIcon size={22} color={colors.pass} />
            <AppText size="lg" weight="bold" style={styles.flex}>
              {strings.importSheet.doneTitle}
            </AppText>
          </View>
          <AppText size="md">
            {strings.importSheet.done(stage.result.testsAdded, stage.result.teachersAdded)}
          </AppText>
          {stage.result.testsSkipped > 0 ? (
            <AppText size="sm" color={colors.textMuted}>
              {strings.importSheet.doneSkipped(stage.result.testsSkipped)}
            </AppText>
          ) : null}
          <Button label={strings.importSheet.close} onPress={() => router.back()} />
        </View>
      )}
    </SafeAreaView>
  );
}

function Review({
  fileName,
  parsed,
  onDone,
}: {
  fileName: string;
  parsed: ParseResult;
  onDone: (result: ImportResult) => void;
}) {
  const uid = useUid();
  const { cities: knownCities } = useCities(uid);
  const { teachers } = useTeachers(uid);

  const [startYear, setStartYear] = useState(() => defaultStartYear(parsed.tests, new Date()));
  const [decisions, setDecisions] = useState<Record<string, PairDecision>>({});
  const [busy, setBusy] = useState(false);

  // Spreadsheet city → the city to file it under, pre-filled with a suggestion.
  const rawCities = useMemo(() => {
    const byCity = new Map<string, string[]>();
    for (const t of parsed.tests) {
      const list = byCity.get(t.rawCity) ?? [];
      list.push(t.rawTeacher);
      byCity.set(t.rawCity, list);
    }
    return [...byCity.entries()].map(([raw, names]) => ({ raw, names }));
  }, [parsed]);
  const [cityMap, setCityMap] = useState<Record<string, string>>(() =>
    Object.fromEntries(rawCities.map(({ raw, names }) => [raw, suggestCity(raw, names, knownCities)])),
  );

  const { dated, invalid } = useMemo(
    () => assignYears(parsed.tests, startYear),
    [parsed, startYear],
  );

  const plan = useMemo(
    () =>
      buildPlan({
        tests: dated,
        cityMap,
        existing: teachers.map((t) => ({ id: t.id, name: t.name, city: t.city })),
        knownCities,
        decisions,
      }),
    [dated, cityMap, teachers, knownCities, decisions],
  );

  const skippedRows = [...parsed.skipped.map((s) => s.row), ...invalid].sort((a, b) => a - b);
  const first = dated[0]?.date;
  const last = dated.reduce<Date | undefined>(
    (max, t) => (!max || t.date > max ? t.date : max),
    undefined,
  );

  const run = async () => {
    setBusy(true);
    try {
      const result = await importBatch(uid, {
        newCities: plan.newCities,
        teachers: plan.teachers,
        tests: plan.tests,
      });
      onDone(result);
    } finally {
      setBusy(false);
    }
  };

  const s = strings.importSheet;

  return (
    <>
      <ScrollView contentContainerStyle={styles.review} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <AppText size="sm" color={colors.textMuted} numberOfLines={1}>
            {fileName}
          </AppText>
          <AppText size="lg" weight="bold">
            {s.summary(dated.length, plan.teachers.length)}
          </AppText>
          {first && last ? (
            <AppText size="sm" color={colors.textMuted}>
              {s.range(formatShortDate(first), formatShortDate(last))}
            </AppText>
          ) : null}
        </View>

        <View style={styles.section}>
          <View style={styles.yearRow}>
            <AppText size="md" weight="medium" style={styles.flex}>
              {s.year}
            </AppText>
            <Stepper label="−" onPress={() => setStartYear((y) => y - 1)} />
            <AppText size="lg" weight="bold" style={styles.year}>
              {String(startYear)}
            </AppText>
            <Stepper label="+" onPress={() => setStartYear((y) => y + 1)} />
          </View>
          <AppText size="xs" color={colors.textFaint}>
            {s.yearHint}
          </AppText>
        </View>

        {skippedRows.length > 0 ? (
          <AppText size="sm" color={colors.warnText}>
            {s.skipped(
              skippedRows.length,
              skippedRows.slice(0, 12).join(', ') + (skippedRows.length > 12 ? '…' : ''),
            )}
          </AppText>
        ) : null}

        <View style={styles.section}>
          <AppText size="md" weight="bold">
            {s.citiesTitle}
          </AppText>
          <AppText size="xs" color={colors.textFaint}>
            {s.citiesHint}
          </AppText>
          {rawCities.map(({ raw, names }) => (
            <CityRow
              key={raw}
              raw={raw}
              count={names.length}
              value={cityMap[raw] ?? raw}
              isNew={!knownCities.includes(cityMap[raw] ?? raw)}
              onCommit={(city) => setCityMap((m) => ({ ...m, [raw]: city || raw }))}
            />
          ))}
        </View>

        {plan.pairs.length > 0 ? (
          <View style={styles.section}>
            <AppText size="md" weight="bold">
              {s.pairsTitle}
            </AppText>
            <AppText size="xs" color={colors.textFaint}>
              {s.pairsHint}
            </AppText>
            {plan.pairs.map((p) => (
              <PairCard
                key={p.id}
                pair={p}
                decision={decisions[p.id]}
                onDecide={(d) => setDecisions((m) => ({ ...m, [p.id]: d }))}
              />
            ))}
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {plan.undecided > 0 ? (
          <AppText size="sm" color={colors.warnText} align="center">
            {s.undecided(plan.undecided)}
          </AppText>
        ) : null}
        <Button
          label={s.run(dated.length)}
          onPress={run}
          disabled={plan.undecided > 0 || dated.length === 0}
          loading={busy}
        />
      </View>
    </>
  );
}

/** City field that commits on blur, so the plan is not rebuilt per keystroke. */
function CityRow({
  raw,
  count,
  value,
  isNew,
  onCommit,
}: {
  raw: string;
  count: number;
  value: string;
  isNew: boolean;
  onCommit: (city: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <View style={styles.cityRow}>
      <View style={styles.cityLabel}>
        <AppText size="sm" weight="medium" numberOfLines={1}>
          {raw}
        </AppText>
        <AppText size="xs" color={colors.textFaint}>
          {strings.importSheet.cityCount(count)}
        </AppText>
      </View>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        onEndEditing={() => onCommit(normalizeCityName(draft))}
        style={styles.cityInput}
        autoCorrect={false}
      />
      {isNew ? (
        <View style={styles.newTag}>
          <AppText size="xs" weight="medium" color={colors.primary}>
            {strings.importSheet.newCity}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

function PairCard({
  pair,
  decision,
  onDecide,
}: {
  pair: ImportPair;
  decision: PairDecision | undefined;
  onDecide: (d: PairDecision) => void;
}) {
  const s = strings.importSheet;
  const side = (x: ImportPair['a']) => (
    <View style={styles.flex}>
      <AppText size="md" weight="bold" numberOfLines={2}>
        {x.name}
      </AppText>
      <AppText size="xs" color={colors.textMuted}>
        {x.existing && x.count === 0 ? s.inApp : s.cityCount(x.count)}
      </AppText>
    </View>
  );
  const choice = (d: PairDecision, label: string) => {
    const selected = decision === d;
    return (
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        onPress={() => onDecide(d)}
        style={[styles.choice, selected && styles.choiceSelected]}
      >
        <AppText
          size="sm"
          weight={selected ? 'bold' : 'medium'}
          color={selected ? '#FFFFFF' : colors.text}
          align="center"
        >
          {label}
        </AppText>
      </Pressable>
    );
  };
  return (
    <View style={[styles.pair, !decision && styles.pairOpen]}>
      <AppText size="xs" color={colors.textFaint}>
        {pair.city}
      </AppText>
      <View style={styles.pairNames}>
        {side(pair.a)}
        <AppText size="md" color={colors.textFaint}>
          ~
        </AppText>
        {side(pair.b)}
      </View>
      <View style={styles.choices}>
        {choice('same', s.same)}
        {choice('different', s.different)}
      </View>
    </View>
  );
}

function Stepper({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.stepper} hitSlop={6}>
      <AppText size="lg" weight="bold" color={colors.primary} align="center">
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingStart: spacing.xl,
    paddingEnd: spacing.md,
    paddingVertical: spacing.sm,
  },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pad: { paddingHorizontal: spacing.xl, gap: spacing.lg, paddingTop: spacing.sm },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  error: {
    backgroundColor: colors.failFaint,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  review: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, gap: spacing.xl },
  card: {
    gap: 4,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  section: { gap: spacing.sm },
  yearRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  year: { minWidth: 56, textAlign: 'center' },
  stepper: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cityLabel: { width: 96 },
  cityInput: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
    backgroundColor: colors.surface,
  },
  newTag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryFaint,
  },
  pair: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pairOpen: { borderColor: colors.warnBorder, backgroundColor: colors.warnFaint },
  pairNames: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  choices: { flexDirection: 'row', gap: spacing.sm },
  choice: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  choiceSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  footer: {
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
