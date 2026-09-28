import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '../theme';
import { strings } from '../strings';
import { AppText, Button, EmptyState, PassRateMeter, TextField } from './ui';
import {
  findDuplicateCandidates,
  normalizeName,
  type DuplicateCandidate,
} from '../lib/hebrewName';
import type { TeacherWithStats } from '../types';

/**
 * Searchable teacher picker with the duplicate guard.
 *
 * The guard is the reason this component exists rather than a plain text field.
 * In the source spreadsheet the teacher was free text, so "דפוס יעקב(קובי)" and
 * "דפס יעקב(קובי)" became two rows for one man and split his record in half.
 *
 * The rule enforced here: a new teacher document is never written until the
 * typed name has been checked against the teachers already in that city, and
 * any near match has been shown to the user. The app never merges on its own —
 * "אור" and "אור פוגל" may well be two people, and only the tester knows.
 */
export function TeacherPicker({
  visible,
  teachers,
  cities,
  onSelect,
  onCreate,
  onClose,
}: {
  visible: boolean;
  /** Teachers in the selected city only. Matching across cities would surface
   *  noise: the same person is not expected to appear in two test centres. */
  teachers: TeacherWithStats[];
  cities: string[];
  onSelect: (teacherId: string) => void;
  onCreate: (name: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [pendingName, setPendingName] = useState<string | null>(null);

  const trimmed = search.trim();

  const results = useMemo(() => {
    const needle = normalizeName(trimmed, cities);
    const list = needle
      ? teachers.filter((t) => normalizeName(t.name, cities).includes(needle))
      : teachers;
    return [...list].sort((a, b) => a.name.localeCompare(b.name, 'he'));
  }, [teachers, trimmed, cities]);

  /** Suppress the create option when the typed name already resolves to an
   *  existing teacher exactly — offering "create" there invites the duplicate. */
  const hasExact = useMemo(() => {
    if (!trimmed) return false;
    const needle = normalizeName(trimmed, cities);
    return teachers.some((t) => normalizeName(t.name, cities) === needle);
  }, [teachers, trimmed, cities]);

  const candidates: DuplicateCandidate<TeacherWithStats>[] = useMemo(
    () => (pendingName ? findDuplicateCandidates(pendingName, teachers, cities) : []),
    [pendingName, teachers, cities],
  );

  const reset = () => {
    setSearch('');
    setPendingName(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  /** Check before writing. Candidates found → ask; none → create straight away. */
  const attemptCreate = (name: string) => {
    const found = findDuplicateCandidates(name, teachers, cities);
    if (found.length > 0) {
      setPendingName(name);
      return;
    }
    reset();
    onCreate(name);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={close}
    >
      <SafeAreaView style={styles.sheet} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <AppText size="lg" weight="bold" style={styles.flex}>
            {pendingName ? strings.duplicateGuard.title : strings.teacherPicker.title}
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={strings.common.close}
            onPress={close}
            hitSlop={12}
          >
            <AppText size="md" weight="medium" color={colors.primary}>
              {strings.common.close}
            </AppText>
          </Pressable>
        </View>

        {pendingName ? (
          <DuplicatePrompt
            name={pendingName}
            candidates={candidates}
            onUseExisting={(id) => {
              reset();
              onSelect(id);
            }}
            onCreateAnyway={() => {
              const name = pendingName;
              reset();
              onCreate(name);
            }}
            onCancel={() => setPendingName(null)}
          />
        ) : (
          <>
            <View style={styles.searchWrap}>
              <TextField
                value={search}
                onChangeText={setSearch}
                placeholder={strings.teacherPicker.search}
                autoFocus
                autoCapitalize="words"
                onSubmitEditing={() => {
                  if (trimmed && !hasExact) attemptCreate(trimmed);
                }}
              />
            </View>

            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.listContent}
              ListHeaderComponent={
                trimmed && !hasExact ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => attemptCreate(trimmed)}
                    style={({ pressed }) => [
                      styles.createRow,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <AppText size="md" weight="bold" color={colors.primary}>
                      {strings.teacherPicker.createNew(trimmed)}
                    </AppText>
                  </Pressable>
                ) : null
              }
              ListEmptyComponent={
                trimmed ? null : (
                  <EmptyState
                    title={strings.teacherPicker.empty}
                    hint={strings.teacherPicker.emptyHint}
                  />
                )
              }
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    reset();
                    onSelect(item.id);
                  }}
                  style={({ pressed }) => [
                    styles.row,
                    pressed && { backgroundColor: colors.bg },
                  ]}
                >
                  <View style={styles.flex}>
                    <AppText size="md" weight="medium" numberOfLines={1}>
                      {item.name}
                    </AppText>
                    <AppText size="xs" color={colors.textFaint}>
                      {item.total > 0
                        ? strings.teacherPicker.testsCount(item.total)
                        : strings.teacherPicker.noTests}
                    </AppText>
                  </View>
                  <PassRateMeter
                    passed={item.passed}
                    total={item.total}
                    hasStats={item.hasStats}
                  />
                </Pressable>
              )}
            />
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

/**
 * "האם התכוונת ל־יעקב דפוס? (רשומים לו 4 מבחנים)"
 *
 * The test count is shown because it is the evidence the tester needs: a near
 * match carrying 40 tests is almost certainly the man he means, while one
 * carrying none is more likely a duplicate he created by mistake earlier.
 *
 * Also used by the add sheet, so both paths to creating a teacher ask
 * the same question.
 */
export function DuplicatePrompt({
  name,
  candidates,
  onUseExisting,
  onCreateAnyway,
  onCancel,
}: {
  name: string;
  candidates: DuplicateCandidate<TeacherWithStats>[];
  onUseExisting: (teacherId: string) => void;
  /** Omitted when the name matches an existing teacher exactly — creating it
   *  then could only be the duplicate. */
  onCreateAnyway?: () => void;
  onCancel: () => void;
}) {
  return (
    <View style={styles.promptWrap}>
      <View style={styles.promptCard}>
        <AppText size="md" weight="medium" color={colors.warnText}>
          {candidates.length === 1
            ? candidates[0].teacher.total > 0
              ? strings.duplicateGuard.question(
                  candidates[0].teacher.name,
                  candidates[0].teacher.total,
                )
              : strings.duplicateGuard.questionNoTests(candidates[0].teacher.name)
            : strings.duplicateGuard.title}
        </AppText>
      </View>

      <View style={styles.candidateList}>
        {candidates.map(({ teacher }) => (
          <Pressable
            key={teacher.id}
            accessibilityRole="button"
            onPress={() => onUseExisting(teacher.id)}
            style={({ pressed }) => [
              styles.candidateRow,
              pressed && { opacity: 0.85 },
            ]}
          >
            <View style={styles.flex}>
              <AppText size="md" weight="bold" numberOfLines={1}>
                {teacher.name}
              </AppText>
              <AppText size="xs" color={colors.textMuted}>
                {teacher.total > 0
                  ? strings.teacherPicker.testsCount(teacher.total)
                  : strings.teacherPicker.noTests}
              </AppText>
            </View>
            <PassRateMeter
              passed={teacher.passed}
              total={teacher.total}
              hasStats={teacher.hasStats}
            />
          </Pressable>
        ))}
      </View>

      <View style={styles.promptActions}>
        {onCreateAnyway ? (
          <Button label={strings.duplicateGuard.createAnyway(name)} onPress={onCreateAnyway} variant="secondary" />
        ) : null}
        <Button label={strings.duplicateGuard.cancel} onPress={onCancel} variant="ghost" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  searchWrap: { padding: spacing.lg },
  listContent: { paddingBottom: spacing.xxl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.md,
    minHeight: 60,
  },
  createRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: colors.primaryFaint,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  promptWrap: { padding: spacing.lg, gap: spacing.lg },
  promptCard: {
    backgroundColor: colors.warnFaint,
    borderWidth: 1,
    borderColor: colors.warnBorder,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  candidateList: { gap: spacing.sm },
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    minHeight: 64,
  },
  promptActions: { gap: spacing.sm, marginTop: spacing.sm },
});
