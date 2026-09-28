import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useUid } from '../../src/backend/auth';
import { addCity, createTeacher, useCities, useTeachers } from '../../src/backend/data';
import { strings } from '../../src/strings';
import { colors, spacing } from '../../src/theme';
import {
  AppText,
  Button,
  Field,
  Segmented,
  SelectRow,
  Tag,
  TextField,
} from '../../src/components/ui';
import { CloseIcon } from '../../src/components/icons';
import { PickerSheet } from '../../src/components/PickerSheet';
import { DuplicatePrompt } from '../../src/components/TeacherPicker';
import { normalizeCityName } from '../../src/lib/cities';
import { findDuplicateCandidates, normalizeName } from '../../src/lib/hebrewName';
import { getLastCity, setLastCity } from '../../src/lib/lastCity';

type Tab = 'teacher' | 'city';
const TABS: readonly Tab[] = ['teacher', 'city'];

/**
 * One sheet for adding a teacher or a city — the two tasks are nearly the same
 * shape, so they share a grabber, a close button, and a segmented switch rather
 * than living behind two header buttons.
 *
 * Params: `tab` picks the starting side; `name` pre-fills the teacher name (the
 * search screen's "add teacher" passes what he had typed).
 *
 * The teacher side runs the duplicate guard before anything is written: the name
 * is checked against the teachers already in the selected city, and any near
 * match is put to him. Nothing is ever merged on its own.
 */
export default function AddScreen() {
  const uid = useUid();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string; name?: string }>();

  const startTab: Tab = params.tab === 'city' ? 'city' : 'teacher';
  const [tab, setTab] = useState<Tab>(startTab);
  // Lifted so a detour to the city tab (no cities yet) keeps what he typed.
  const [teacherName, setTeacherName] = useState(params.name ?? '');
  const [teacherCity, setTeacherCity] = useState<string | null>(null);
  const [cityDetour, setCityDetour] = useState(false);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.grabber} />
      <View style={styles.header}>
        <AppText size="lg" weight="bold" style={styles.flex}>
          {strings.add.title}
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

      <View style={styles.tabs}>
        <Segmented
          options={TABS}
          value={tab}
          onChange={setTab}
          labelFor={(t) => strings.add.tabs[t]}
        />
      </View>

      {tab === 'teacher' ? (
        <TeacherForm
          uid={uid}
          name={teacherName}
          onChangeName={setTeacherName}
          city={teacherCity}
          onChangeCity={setTeacherCity}
          onNeedCity={() => {
            setCityDetour(true);
            setTab('city');
          }}
        />
      ) : (
        <CityForm
          uid={uid}
          onAdded={(city) => {
            // Came here only to create the teacher's city: go back to the
            // teacher with it selected. Otherwise adding a city was the task.
            if (cityDetour) {
              setTeacherCity(city);
              setCityDetour(false);
              setTab('teacher');
            } else {
              router.back();
            }
          }}
        />
      )}
    </SafeAreaView>
  );
}

function TeacherForm({
  uid,
  name,
  onChangeName: setName,
  city,
  onChangeCity: setCity,
  onNeedCity,
}: {
  uid: string;
  name: string;
  onChangeName: (name: string) => void;
  city: string | null;
  onChangeCity: (city: string | null) => void;
  onNeedCity: () => void;
}) {
  const router = useRouter();
  const { cities } = useCities(uid);
  const { teachers } = useTeachers(uid);

  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (city) return;
    void getLastCity().then((stored) => {
      if (stored && cities.includes(stored)) setCity(stored);
    });
    // Only on first mount — later changes are his own choices.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const trimmed = name.trim();

  const teachersInCity = useMemo(
    () => (city ? teachers.filter((t) => t.city === city) : []),
    [teachers, city],
  );

  const candidates = useMemo(
    () => (checking ? findDuplicateCandidates(trimmed, teachersInCity, cities) : []),
    [checking, trimmed, teachersInCity, cities],
  );

  const hasExact = useMemo(() => {
    const needle = normalizeName(trimmed, cities);
    return teachersInCity.some((t) => normalizeName(t.name, cities) === needle);
  }, [teachersInCity, trimmed, cities]);

  const create = () => {
    if (!city) return;
    // Not awaited: the id is generated client-side and the write lands in the
    // local cache at once, which is all the list screen needs.
    createTeacher(uid, trimmed, city);
    setLastCity(city);
    router.back();
  };

  /** Check before writing. Candidates found → ask; none → create straight away. */
  const save = () => {
    const next: Record<string, string> = {};
    if (!trimmed) next.name = strings.add.errors.teacherNameRequired;
    if (!city) next.city = strings.add.errors.cityRequired;
    setErrors(next);
    if (Object.keys(next).length > 0 || !city) return;

    if (findDuplicateCandidates(trimmed, teachersInCity, cities).length > 0) {
      setChecking(true);
      return;
    }
    create();
  };

  if (checking) {
    return (
      <DuplicatePrompt
        name={trimmed}
        candidates={candidates}
        onUseExisting={(id) => router.replace(`/(app)/teacher/${id}`)}
        onCreateAnyway={hasExact ? undefined : create}
        onCancel={() => setChecking(false)}
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
      <Field label={strings.add.teacherName} error={errors.name}>
        <TextField
          value={name}
          onChangeText={setName}
          placeholder={strings.add.teacherNamePlaceholder}
          autoCapitalize="words"
          autoFocus
          invalid={Boolean(errors.name)}
        />
      </Field>

      <Field label={strings.add.city} error={errors.city}>
        <SelectRow
          value={city}
          placeholder={
            cities.length > 0 ? strings.add.cityPlaceholder : strings.add.noCities
          }
          onPress={() => (cities.length > 0 ? setCityPickerOpen(true) : onNeedCity())}
          invalid={Boolean(errors.city)}
        />
      </Field>

      <Button label={strings.add.saveTeacher} onPress={save} />

      <PickerSheet
        visible={cityPickerOpen}
        title={strings.add.city}
        options={cities}
        selected={city}
        onSelect={setCity}
        onClose={() => setCityPickerOpen(false)}
      />
    </ScrollView>
  );
}

function CityForm({ uid, onAdded }: { uid: string; onAdded: (city: string) => void }) {
  const { cities } = useCities(uid);

  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const city = normalizeCityName(name);
    if (!city) {
      setError(strings.add.errors.cityNameRequired);
      return;
    }
    if (cities.includes(city)) {
      setError(strings.add.errors.cityExists);
      return;
    }
    // Not awaited — the local cache updates every city list at once.
    addCity(uid, city);
    onAdded(city);
  };

  return (
    <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
      <Field label={strings.add.cityName} error={error}>
        <TextField
          value={name}
          onChangeText={(t) => {
            setName(t);
            if (error) setError(null);
          }}
          placeholder={strings.add.cityNamePlaceholder}
          autoCapitalize="words"
          autoFocus
          onSubmitEditing={save}
          invalid={Boolean(error)}
        />
      </Field>

      {/* Tags, not rows: they are there to be read, not tapped. */}
      {cities.length > 0 ? (
        <View style={styles.existing}>
          <AppText size="xs" color={colors.textMuted}>
            {strings.add.existingCities}
          </AppText>
          <View style={styles.tagWrap}>
            {cities.map((c) => (
              <Tag key={c} label={c} />
            ))}
          </View>
        </View>
      ) : null}

      <Button label={strings.add.saveCity} onPress={save} />
    </ScrollView>
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
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
  form: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, gap: spacing.lg },
  existing: { gap: spacing.sm },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
