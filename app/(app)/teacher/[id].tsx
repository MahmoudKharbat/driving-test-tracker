import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';

import { useUid } from '../../../src/auth';
import {
  deleteTeacherWithTests,
  deleteTest,
  passRate,
  updateTest,
  useTeachers,
  useTests,
} from '../../../src/data';
import { strings } from '../../../src/strings';
import { colors, radius, spacing } from '../../../src/theme';
import {
  AppText,
  Button,
  EmptyState,
  Loading,
  PassFailToggle,
} from '../../../src/components/ui';
import { endOfToday, formatShortDate, formatWeekday, startOfDay } from '../../../src/lib/date';
import type { TestResult, TestWithId } from '../../../src/types';

/**
 * Teacher detail: the running totals plus the full chronological history.
 *
 * Totals are read from `teacherStats`, never recomputed from the test list on
 * screen. The two can disagree for a second or two while the Cloud Function
 * catches up, and the stats document is the figure that must be trusted —
 * recomputing here would mean the list screen and this screen could show
 * different numbers for the same teacher.
 */
export default function TeacherDetailScreen() {
  const uid = useUid();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const teacherId = String(id);

  const { teachers, loading: teachersLoading } = useTeachers(uid);
  const { tests, loading: testsLoading } = useTests(uid, teacherId);

  const [editing, setEditing] = useState<TestWithId | null>(null);

  const teacher = useMemo(
    () => teachers.find((t) => t.id === teacherId) ?? null,
    [teachers, teacherId],
  );

  const confirmDeleteTeacher = () => {
    Alert.alert(
      strings.teacherDetail.deleteTeacherConfirmTitle,
      strings.teacherDetail.deleteTeacherConfirmBody,
      [
        { text: strings.common.cancel, style: 'cancel' },
        {
          text: strings.common.delete,
          style: 'destructive',
          onPress: () => {
            // Only the cache-backed read inside is awaited; the deletes
            // themselves are fire-and-forget, so this returns promptly even
            // with no connection. Navigate back regardless.
            void deleteTeacherWithTests(uid, teacherId);
            router.back();
          },
        },
      ],
    );
  };

  if (teachersLoading) return <Loading />;

  if (!teacher) {
    // Reachable if the teacher was deleted from another device while this
    // screen was open.
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <EmptyState title={strings.teacherDetail.empty} />
      </SafeAreaView>
    );
  }

  const rate = passRate(teacher.passed, teacher.total);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{ title: teacher.name }} />

      <FlatList
        data={tests}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <View style={styles.flex}>
                <AppText size="xl" weight="bold" numberOfLines={2}>
                  {teacher.name}
                </AppText>
                <AppText size="sm" color={colors.textMuted}>
                  {teacher.city}
                </AppText>
              </View>
            </View>

            <View style={styles.statsRow}>
              <Stat
                label={strings.teacherDetail.passed}
                value={String(teacher.passed)}
                color={colors.pass}
              />
              <Stat
                label={strings.teacherDetail.failed}
                value={String(teacher.failed)}
                color={colors.fail}
              />
              <Stat label={strings.teacherDetail.total} value={String(teacher.total)} />
              <Stat
                label={strings.teacherDetail.passRate}
                value={teacher.total > 0 ? `${rate}%` : '—'}
                color={colors.primary}
              />
            </View>

            {/* The Cloud Function has not written stats yet, but tests exist
                locally — most likely an offline write still queued. */}
            {!teacher.hasStats && tests.length > 0 ? (
              <View style={styles.pending}>
                <AppText size="xs" color={colors.warnText} align="center">
                  {strings.teacherDetail.statsPending}
                </AppText>
              </View>
            ) : null}

            <AppText size="sm" weight="bold" color={colors.textMuted} style={styles.historyTitle}>
              {strings.teacherDetail.history}
            </AppText>
          </View>
        }
        ListEmptyComponent={
          testsLoading ? <Loading /> : <EmptyState title={strings.teacherDetail.empty} />
        }
        ListFooterComponent={
          <View style={styles.footer}>
            <Button
              label={strings.teacherDetail.deleteTeacher}
              variant="ghost"
              onPress={confirmDeleteTeacher}
            />
          </View>
        }
        renderItem={({ item }) => {
          const date = item.date?.toDate?.() ?? new Date();
          const isPass = item.result === 'pass';
          return (
            <Pressable
              accessibilityRole="button"
              onPress={() => setEditing(item)}
              style={({ pressed }) => [
                styles.testRow,
                pressed && { backgroundColor: colors.bg },
              ]}
            >
              <View
                style={[
                  styles.resultPill,
                  { backgroundColor: isPass ? colors.passFaint : colors.failFaint },
                ]}
              >
                <AppText
                  size="sm"
                  weight="bold"
                  color={isPass ? colors.pass : colors.fail}
                >
                  {isPass ? strings.newTest.pass : strings.newTest.fail}
                </AppText>
              </View>

              <View style={styles.flex}>
                <AppText size="md" weight="medium">
                  {formatShortDate(date)}
                </AppText>
                <AppText size="xs" color={colors.textFaint}>
                  {formatWeekday(date)}
                </AppText>
              </View>
            </Pressable>
          );
        }}
      />

      {editing ? (
        <EditTestSheet
          test={editing}
          onClose={() => setEditing(null)}
          onSave={(date, result) => {
            updateTest(uid, teacherId, editing.id, date, result);
            setEditing(null);
          }}
          onDelete={() => {
            deleteTest(uid, teacherId, editing.id);
            setEditing(null);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

function Stat({
  label,
  value,
  color = colors.text,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <View style={styles.stat}>
      <AppText size="xl" weight="bold" color={color} align="center">
        {value}
      </AppText>
      <AppText size="xs" color={colors.textMuted} align="center">
        {label}
      </AppText>
    </View>
  );
}

/**
 * Edit or delete one test entry.
 *
 * Every write here re-triggers the aggregation function, so the totals above
 * and the badge on the list screen both follow automatically.
 */
function EditTestSheet({
  test,
  onClose,
  onSave,
  onDelete,
}: {
  test: TestWithId;
  onClose: () => void;
  /** Synchronous: the write commits locally and the sheet closes at once. See
   *  the note on writes in src/data.ts for why nothing here awaits the server. */
  onSave: (date: Date, result: TestResult) => void;
  onDelete: () => void;
}) {
  const [date, setDate] = useState<Date>(() =>
    startOfDay(test.date?.toDate?.() ?? new Date()),
  );
  const [result, setResult] = useState<TestResult>(test.result);
  const [datePickerOpen, setDatePickerOpen] = useState(Platform.OS === 'ios');

  const onDateChange = (event: DateTimePickerEvent, picked?: Date) => {
    if (Platform.OS === 'android') setDatePickerOpen(false);
    if (event.type === 'dismissed' || !picked) return;
    setDate(startOfDay(picked));
  };

  const confirmDelete = () => {
    Alert.alert(
      strings.editTest.deleteConfirmTitle,
      strings.editTest.deleteConfirmBody,
      [
        { text: strings.common.cancel, style: 'cancel' },
        {
          text: strings.common.delete,
          style: 'destructive',
          onPress: onDelete,
        },
      ],
    );
  };

  return (
    <View style={styles.editOverlay}>
      <Pressable
        style={styles.editBackdrop}
        accessibilityRole="button"
        accessibilityLabel={strings.common.close}
        onPress={onClose}
      />
      <View style={styles.editSheet}>
        <AppText size="lg" weight="bold">
          {strings.editTest.title}
        </AppText>

        {Platform.OS === 'android' ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setDatePickerOpen(true)}
            style={styles.editDateRow}
          >
            <AppText size="md">{formatShortDate(date)}</AppText>
          </Pressable>
        ) : null}

        {datePickerOpen ? (
          <View style={styles.editDatePicker}>
            <DateTimePicker
              value={date}
              mode="date"
              display={Platform.OS === 'ios' ? 'compact' : 'default'}
              maximumDate={endOfToday()}
              locale="he-IL"
              onChange={onDateChange}
            />
          </View>
        ) : null}

        <PassFailToggle value={result} onChange={setResult} />

        <Button
          label={strings.editTest.save}
          onPress={() => onSave(date, result)}
        />
        <Button
          label={strings.editTest.delete}
          variant="danger"
          onPress={confirmDelete}
        />
        <Button label={strings.common.cancel} variant="ghost" onPress={onClose} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  listContent: { paddingBottom: spacing.xxl },
  header: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  stat: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  pending: {
    backgroundColor: colors.warnFaint,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
  },
  historyTitle: { marginTop: spacing.sm },
  footer: { padding: spacing.lg },
  testRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    minHeight: 60,
  },
  resultPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    minWidth: 64,
    alignItems: 'center',
  },
  editOverlay: { ...StyleSheet.absoluteFill, justifyContent: 'flex-end' },
  editBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: '#0F172A66' },
  editSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  editDateRow: {
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  editDatePicker: { alignItems: 'flex-start' },
});
