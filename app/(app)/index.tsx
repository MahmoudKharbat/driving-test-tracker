import React, { useMemo, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useAuth, useUid } from '../../src/backend/auth';
import {
  exportTestsCsv,
  filterAndSortTeachers,
  passRate,
  useCities,
  useTeachers,
} from '../../src/backend/data';
import { strings } from '../../src/strings';
import { colors, fontSize, radius, spacing } from '../../src/theme';
import {
  AppText,
  Button,
  EmptyState,
  Loading,
  PassRateMeter,
} from '../../src/components/ui';
import {
  ChevronDownIcon,
  MoreIcon,
  PlusIcon,
  SearchIcon,
  UserPlusIcon,
} from '../../src/components/icons';
import { Dropdown } from '../../src/components/Dropdown';
import { formatDayMonth, formatShortMonth } from '../../src/lib/date';
import { normalizeName } from '../../src/lib/hebrewName';
import type { TeacherSort, TeacherWithStats } from '../../src/types';

const SORTS: readonly TeacherSort[] = [
  'recentlyTested',
  'mostTests',
  'lowestPassRate',
  'name',
];

const ALL_CITIES = '__all__';

/**
 * Test summary — the screen that replaces the spreadsheet's `סיכום` pivot tab.
 *
 * Every row carries its pass rate straight from `teacherStats`, so the answer he
 * opens the app for ("how has this teacher's students done with me?") is
 * visible without drilling in. The totals strip sums those same per-teacher
 * aggregates — it never reads individual tests.
 *
 * Search, filter and sort all run on the already-subscribed data rather than as
 * Firestore queries. That is deliberate: it keeps the whole screen usable with
 * no connection, and sorting by pass rate spans two collections so it could not
 * have been a server-side query in any case.
 */
export default function SummaryScreen() {
  const uid = useUid();
  const router = useRouter();
  const { signOut, accountsEnabled } = useAuth();

  const { cities } = useCities(uid);
  const { teachers, loading } = useTeachers(uid);

  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [city, setCity] = useState<string | null>(null);
  const [sort, setSort] = useState<TeacherSort>('mostTests');

  const visible = useMemo(
    () => filterAndSortTeachers(teachers, { search: '', city, sort, cities }),
    [teachers, city, sort, cities],
  );

  /** Search matches the teacher's name (normalised, so spelling noise does not
   *  hide him) or his city. */
  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return filterAndSortTeachers(teachers, { search: '', city: null, sort: 'name', cities });
    const needle = normalizeName(q, cities);
    return filterAndSortTeachers(
      teachers.filter(
        (t) =>
          (needle && normalizeName(t.name, cities).includes(needle)) ||
          t.city.includes(q),
      ),
      { search: '', city: null, sort: 'name', cities },
    );
  }, [teachers, query, cities]);

  const totals = useMemo(() => {
    let passed = 0;
    let total = 0;
    for (const t of teachers) {
      passed += t.passed;
      total += t.total;
    }
    return { passed, total };
  }, [teachers]);

  const cityOptions = useMemo(() => [ALL_CITIES, ...cities], [cities]);

  const exportCsv = () => {
    exportTestsCsv(uid).catch(() =>
      Alert.alert(strings.common.error, strings.exportCsv.failed),
    );
  };

  const confirmSignOut = () =>
    Alert.alert(strings.auth.signOutConfirmTitle, strings.auth.signOutConfirmBody, [
      { text: strings.common.cancel, style: 'cancel' },
      { text: strings.auth.signOut, style: 'destructive', onPress: () => void signOut() },
    ]);

  /** Export always; sign-out only in the Firebase build — the phone-only build
   *  has no account to leave. */
  const openMenu = () => {
    const items = [
      { label: strings.exportCsv.action, run: exportCsv, destructive: false },
      ...(accountsEnabled
        ? [{ label: strings.auth.signOut, run: confirmSignOut, destructive: true }]
        : []),
    ];

    if (Platform.OS === 'ios') {
      const destructive = items.findIndex((i) => i.destructive);
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...items.map((i) => i.label), strings.common.cancel],
          cancelButtonIndex: items.length,
          ...(destructive >= 0 ? { destructiveButtonIndex: destructive } : {}),
        },
        (index) => items[index]?.run(),
      );
    } else {
      Alert.alert(strings.teachers.more, undefined, [
        ...items.map((i) => ({
          text: i.label,
          style: i.destructive ? ('destructive' as const) : ('default' as const),
          onPress: i.run,
        })),
        { text: strings.common.cancel, style: 'cancel' as const },
      ]);
    }
  };

  const closeSearch = () => {
    setQuery('');
    setSearching(false);
  };

  const openTeacher = (id: string) => router.push(`/(app)/teacher/${id}`);

  if (searching) {
    const q = query.trim();
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.searchHeader}>
          <View style={styles.searchField}>
            <View style={styles.searchFieldIcon} pointerEvents="none">
              <SearchIcon size={18} color={colors.textMuted} />
            </View>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={strings.teachers.searchPlaceholder}
              placeholderTextColor={colors.textFaint}
              autoFocus
              autoCorrect={false}
              returnKeyType="search"
              style={styles.searchInput}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={closeSearch}
            hitSlop={8}
            style={styles.cancel}
          >
            <AppText size="md" weight="medium" color={colors.primary}>
              {strings.teachers.cancelSearch}
            </AppText>
          </Pressable>
        </View>

        <AppText size="xs" color={colors.textMuted} style={styles.resultLabel}>
          {q ? strings.teachers.results(results.length) : strings.teachers.allTeachers}
        </AppText>

        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listPad}
          ListEmptyComponent={
            q ? (
              <View style={styles.noMatch}>
                <AppText size="md">{strings.teachers.noMatch}</AppText>
                <Button
                  label={strings.teachers.addTeacherCta}
                  variant="secondary"
                  style={styles.noMatchButton}
                  onPress={() =>
                    router.push({
                      pathname: '/(app)/add',
                      params: { tab: 'teacher', name: q },
                    })
                  }
                />
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() => openTeacher(item.id)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={styles.flex}>
                <AppText size="md" weight="medium" numberOfLines={1}>
                  {item.name}
                </AppText>
                <AppText size="sm" color={colors.textMuted} numberOfLines={1}>
                  {subtitle(item)}
                </AppText>
              </View>
              <AppText size="md" weight="medium">
                {item.total > 0 ? `${passRate(item.passed, item.total)}%` : '—'}
              </AppText>
            </Pressable>
          )}
        />
      </SafeAreaView>
    );
  }

  const byDate = sort === 'recentlyTested';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Title centred; under RTL the row runs right-to-left, so search sits
          on the right and ⋯ on the left. */}
      <View style={styles.header}>
        <AppText
          size="lg"
          weight="bold"
          align="center"
          style={styles.headerTitle}
          numberOfLines={1}
        >
          {strings.teachers.title}
        </AppText>
        <IconButton label={strings.teachers.search} onPress={() => setSearching(true)}>
          <SearchIcon color={colors.text} />
        </IconButton>
        <IconButton label={strings.teachers.more} onPress={openMenu}>
          <MoreIcon color={colors.text} />
        </IconButton>
      </View>

      <View style={styles.stats}>
        <Stat
          value={totals.total > 0 ? `${passRate(totals.passed, totals.total)}%` : '—'}
          label={strings.teachers.stats.passRate}
        />
        <Stat value={String(totals.total)} label={strings.teachers.stats.tests} />
        <Stat value={String(teachers.length)} label={strings.teachers.stats.teachers} />
        <Stat value={String(cities.length)} label={strings.teachers.stats.cities} />
      </View>

      <View style={styles.chipRow}>
        <Dropdown
          options={cityOptions}
          selected={city ?? ALL_CITIES}
          labelFor={(c) => (c === ALL_CITIES ? strings.teachers.allCities : c)}
          onSelect={(c) => setCity(c === ALL_CITIES ? null : c)}
        >
          {(open) => (
            <Chip
              label={city ?? strings.teachers.allCities}
              active={Boolean(city)}
              onPress={open}
            />
          )}
        </Dropdown>
        <Dropdown
          options={SORTS}
          selected={sort}
          labelFor={(s) => strings.teachers.sort[s]}
          onSelect={setSort}
        >
          {(open) => (
            <Chip
              label={strings.teachers.sortChip(strings.teachers.sort[sort])}
              active={false}
              onPress={open}
            />
          )}
        </Dropdown>
      </View>

      {loading ? (
        <Loading />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listPad}
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
              onPress={() => openTeacher(item.id)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              {byDate ? <DateBlock item={item} /> : null}
              <View style={styles.flex}>
                <AppText size="md" weight="medium" numberOfLines={1}>
                  {item.name}
                </AppText>
                <AppText size="sm" color={colors.textMuted} numberOfLines={1}>
                  {byDate ? item.city : subtitle(item)}
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
      )}

      {/* Docked, not floating: nothing covers the last rows, and logging a test
          stays one tap from the screen he opens into. */}
      <View style={styles.bottomBar}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/(app)/new-test')}
          style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}
        >
          <PlusIcon size={18} color="#FFFFFF" />
          <AppText size="md" weight="bold" color="#FFFFFF">
            {strings.newTest.title}
          </AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={strings.teachers.addMenu}
          onPress={() => router.push('/(app)/add')}
          style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}
        >
          <UserPlusIcon size={20} color={colors.text} />
        </Pressable>
      </View>

    </SafeAreaView>
  );
}

/** "כפר סבא · אחרון 26.09" — day and month only; the year is noise here. */
function subtitle(t: TeacherWithStats): string {
  return t.lastTestedAt
    ? `${t.city} · ${strings.teachers.last(formatDayMonth(t.lastTestedAt.toDate()))}`
    : t.city;
}

/** Leading day/month block, shown when the list is sorted by date so the
 *  ordering is visible at a glance. */
function DateBlock({ item }: { item: TeacherWithStats }) {
  const date = item.lastTestedAt?.toDate() ?? null;
  return (
    <View style={styles.dateBlock}>
      <AppText size="lg" weight="bold" align="center">
        {date ? String(date.getDate()) : '—'}
      </AppText>
      {date ? (
        <AppText size="xs" color={colors.textMuted} align="center">
          {formatShortMonth(date)}
        </AppText>
      ) : null}
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <AppText size="xl" weight="bold">
        {value}
      </AppText>
      <AppText size="xs" color={colors.textMuted}>
        {label}
      </AppText>
    </View>
  );
}

function IconButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
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
  const color = active ? colors.primary : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active && styles.chipActive,
        pressed && styles.pressed,
      ]}
    >
      <AppText size="sm" weight="medium" color={color} numberOfLines={1}>
        {label}
      </AppText>
      <ChevronDownIcon size={12} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  // Absolutely centred across the full width, so the icons on either side
  // cannot pull it off-centre.
  headerTitle: {
    position: 'absolute',
    left: 56,
    right: 56,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stats: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xs,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  stat: { flex: 1, gap: 2 },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryFaint,
  },
  listPad: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 62,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowPressed: { opacity: 0.6 },
  dateBlock: {
    width: 44,
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  bottomBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  primaryAction: {
    flex: 1,
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  secondaryAction: {
    width: 50,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: 10,
  },
  searchField: { flex: 1, justifyContent: 'center' },
  searchFieldIcon: { position: 'absolute', start: 12, zIndex: 1 },
  searchInput: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingStart: 38,
    paddingEnd: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  cancel: { minHeight: 44, justifyContent: 'center' },
  resultLabel: { paddingHorizontal: spacing.xl, paddingBottom: 6 },
  noMatch: { paddingVertical: spacing.xxl, gap: spacing.md, alignItems: 'flex-start' },
  noMatchButton: { alignSelf: 'flex-start' },
});
