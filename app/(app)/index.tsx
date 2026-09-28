import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useAuth, useUid } from '../../src/auth';
import { filterAndSortTeachers, useCities, useTeachers } from '../../src/data';
import { strings } from '../../src/strings';
import { colors, radius, spacing } from '../../src/theme';
import {
  AppText,
  EmptyState,
  Loading,
  PassRateBadge,
  TextField,
} from '../../src/components/ui';
import { PickerSheet } from '../../src/components/PickerSheet';
import type { TeacherSort } from '../../src/types';

const SORTS: readonly TeacherSort[] = [
  'mostTests',
  'lowestPassRate',
  'recentlyTested',
  'name',
];

const ALL_CITIES = '__all__';

/**
 * Teacher list — the screen that replaces the spreadsheet's `סיכום` pivot tab.
 *
 * Every row carries its pass-rate badge straight from `teacherStats`, so the
 * answer he opens the app for ("how has this teacher's students done with me?")
 * is visible without drilling in.
 *
 * Search, filter and sort all run on the already-subscribed data rather than as
 * Firestore queries. That is deliberate: it keeps the whole screen usable with
 * no connection, and sorting by pass rate spans two collections so it could not
 * have been a server-side query in any case.
 */
export default function TeacherListScreen() {
  const uid = useUid();
  const router = useRouter();
  const { signOut } = useAuth();

  const { cities } = useCities();
  const { teachers, loading } = useTeachers(uid);

  const [search, setSearch] = useState('');
  const [city, setCity] = useState<string | null>(null);
  const [sort, setSort] = useState<TeacherSort>('mostTests');
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [sortPickerOpen, setSortPickerOpen] = useState(false);

  const visible = useMemo(
    () => filterAndSortTeachers(teachers, { search, city, sort, cities }),
    [teachers, search, city, sort, cities],
  );

  const cityOptions = useMemo(() => [ALL_CITIES, ...cities], [cities]);

  const confirmSignOut = () => {
    Alert.alert(
      strings.auth.signOutConfirmTitle,
      strings.auth.signOutConfirmBody,
      [
        { text: strings.common.cancel, style: 'cancel' },
        {
          text: strings.auth.signOut,
          style: 'destructive',
          onPress: () => void signOut(),
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.controls}>
        <TextField
          value={search}
          onChangeText={setSearch}
          placeholder={strings.teachers.search}
          autoCapitalize="words"
        />

        <View style={styles.chipRow}>
          <Chip
            label={city ?? strings.teachers.allCities}
            active={Boolean(city)}
            onPress={() => setCityPickerOpen(true)}
          />
          <Chip
            label={strings.teachers.sort[sort]}
            active
            onPress={() => setSortPickerOpen(true)}
          />
          <View style={styles.flex} />
          <Pressable
            accessibilityRole="button"
            onPress={confirmSignOut}
            hitSlop={8}
            style={styles.signOut}
          >
            <AppText size="sm" color={colors.textMuted}>
              {strings.auth.signOut}
            </AppText>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <Loading />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            teachers.length === 0 ? (
              <EmptyState
                title={strings.teachers.empty}
                hint={strings.teachers.emptyHint}
              />
            ) : (
              <EmptyState title={strings.teachers.noResults} />
            )
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/(app)/teacher/${item.id}`)}
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
                  {item.city}
                </AppText>
              </View>
              <PassRateBadge
                passed={item.passed}
                total={item.total}
                hasStats={item.hasStats}
              />
            </Pressable>
          )}
        />
      )}

      {/* The primary action. Logging a test is the core loop and must never be
          more than one tap from the screen he opens into. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={strings.newTest.title}
        onPress={() => router.push('/(app)/new-test')}
        style={({ pressed }) => [styles.fab, pressed && { opacity: 0.9 }]}
      >
        <AppText size="lg" weight="bold" color="#FFFFFF" align="center">
          {`+  ${strings.newTest.title}`}
        </AppText>
      </Pressable>

      <PickerSheet
        visible={cityPickerOpen}
        title={strings.newTest.city}
        options={cityOptions}
        selected={city ?? ALL_CITIES}
        labelFor={(c) => (c === ALL_CITIES ? strings.teachers.allCities : c)}
        onSelect={(c) => setCity(c === ALL_CITIES ? null : c)}
        onClose={() => setCityPickerOpen(false)}
      />

      <PickerSheet
        visible={sortPickerOpen}
        title={strings.teachers.sortBy}
        options={SORTS}
        selected={sort}
        labelFor={(s) => strings.teachers.sort[s]}
        onSelect={setSort}
        onClose={() => setSortPickerOpen(false)}
      />
    </SafeAreaView>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active && styles.chipActive,
        pressed && { opacity: 0.85 },
      ]}
    >
      <AppText
        size="sm"
        weight="medium"
        color={active ? colors.primary : colors.textMuted}
      >
        {`${label} ▾`}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  controls: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryFaint,
  },
  signOut: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  listContent: { paddingBottom: 96 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    minHeight: 64,
  },
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    left: spacing.lg,
    right: spacing.lg,
    minHeight: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
