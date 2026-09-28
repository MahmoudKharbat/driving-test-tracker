import React, { useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';

import { useUid } from '../../src/backend/auth';
import { createTeacher, createTest, useCities, useTeachers } from '../../src/backend/data';
import { strings } from '../../src/strings';
import { colors, spacing } from '../../src/theme';
import { Button, Field, PassFailToggle, SelectRow } from '../../src/components/ui';
import { PickerSheet } from '../../src/components/PickerSheet';
import { TeacherPicker } from '../../src/components/TeacherPicker';
import { endOfToday, formatLongDate, startOfDay } from '../../src/lib/date';
import { getLastCity, setLastCity } from '../../src/lib/lastCity';
import type { TestResult } from '../../src/types';

/**
 * Log a test — the core loop, targeted at under ten seconds.
 *
 * The budget is spent as: city pre-filled from last use (0 taps), teacher
 * picked by typing two or three letters (~3), date defaulted to today (0),
 * result (1), save (1).
 *
 * The save is not awaited before dismissing. Firestore commits to the local
 * cache synchronously and syncs in the background, so waiting on the network
 * round trip would add seconds of dead time and would fail outright in the
 * field, which is exactly where he is when logging.
 */
export default function NewTestScreen() {
  const uid = useUid();
  const router = useRouter();

  const { cities } = useCities(uid);
  const { teachers } = useTeachers(uid);

  const [city, setCity] = useState<string | null>(null);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [date, setDate] = useState<Date>(() => startOfDay(new Date()));
  const [result, setResult] = useState<TestResult | null>(null);

  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [teacherPickerOpen, setTeacherPickerOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(Platform.OS === 'ios');

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    void getLastCity().then((stored) => {
      if (stored) setCity((current) => current ?? stored);
    });
  }, []);

  const teachersInCity = useMemo(
    () => (city ? teachers.filter((t) => t.city === city) : []),
    [teachers, city],
  );

  const selectedTeacher = useMemo(
    () => teachers.find((t) => t.id === teacherId) ?? null,
    [teachers, teacherId],
  );

  const chooseCity = (next: string) => {
    setCity(next);
    setLastCity(next);
    // The teacher belongs to the old city and is no longer a valid choice.
    setTeacherId(null);
  };

  const onDateChange = (event: DateTimePickerEvent, picked?: Date) => {
    if (Platform.OS === 'android') setDatePickerOpen(false);
    if (event.type === 'dismissed' || !picked) return;
    setDate(startOfDay(picked));
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!city) next.city = strings.newTest.errors.cityRequired;
    if (!teacherId) next.teacher = strings.newTest.errors.teacherRequired;
    if (!result) next.result = strings.newTest.errors.resultRequired;
    if (date.getTime() > endOfToday().getTime()) {
      next.date = strings.newTest.errors.dateInFuture;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  /**
   * Not awaited, and not guarded by a spinner.
   *
   * The write commits to the local cache synchronously and every listener has
   * already fired by the time this returns; the server round trip is irrelevant
   * to whether the test was recorded. Awaiting it would hang forever offline —
   * which is where he usually is.
   */
  const save = () => {
    if (!validate() || !teacherId || !result) return;
    createTest(uid, teacherId, date, result);
    router.back();
  };

  const createAndSelectTeacher = (name: string) => {
    if (!city) return;
    // The id is generated client-side, so it is available immediately and the
    // new teacher can be selected without waiting for the network.
    setTeacherId(createTeacher(uid, name, city));
    setTeacherPickerOpen(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Field label={strings.newTest.city} error={errors.city}>
          <SelectRow
            value={city}
            placeholder={
              cities.length > 0 ? strings.newTest.cityPlaceholder : strings.newTest.noCities
            }
            // A fresh install has no cities; send him to add the first one
            // rather than open an empty list.
            onPress={() =>
              cities.length > 0
                ? setCityPickerOpen(true)
                : router.push({ pathname: '/(app)/add', params: { tab: 'city' } })
            }
            invalid={Boolean(errors.city)}
          />
        </Field>

        <Field label={strings.newTest.teacher} error={errors.teacher}>
          <SelectRow
            value={selectedTeacher?.name ?? null}
            placeholder={
              city
                ? strings.newTest.teacherPlaceholder
                : strings.newTest.teacherPickCityFirst
            }
            onPress={() => setTeacherPickerOpen(true)}
            disabled={!city}
            invalid={Boolean(errors.teacher)}
          />
        </Field>

        <Field label={strings.newTest.date} error={errors.date}>
          {Platform.OS === 'android' ? (
            <SelectRow
              value={formatLongDate(date)}
              placeholder={strings.newTest.date}
              onPress={() => setDatePickerOpen(true)}
              invalid={Boolean(errors.date)}
            />
          ) : null}

          {datePickerOpen ? (
            <View style={styles.datePicker}>
              <DateTimePicker
                value={date}
                mode="date"
                display={Platform.OS === 'ios' ? 'compact' : 'default'}
                // A test cannot have happened tomorrow. Blocking it at the
                // picker is better than validating after the fact.
                maximumDate={endOfToday()}
                locale="he-IL"
                onChange={onDateChange}
              />
            </View>
          ) : null}
        </Field>

        <Field label={strings.newTest.result} error={errors.result}>
          <PassFailToggle value={result} onChange={setResult} />
        </Field>

        <Button
          label={strings.newTest.save}
          onPress={save}
        />
      </ScrollView>

      <PickerSheet
        visible={cityPickerOpen}
        title={strings.newTest.city}
        options={cities}
        selected={city}
        onSelect={chooseCity}
        onClose={() => setCityPickerOpen(false)}
      />

      <TeacherPicker
        visible={teacherPickerOpen}
        teachers={teachersInCity}
        cities={cities}
        onSelect={(id) => {
          setTeacherId(id);
          setTeacherPickerOpen(false);
        }}
        onCreate={createAndSelectTeacher}
        onClose={() => setTeacherPickerOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.xl },
  datePicker: { alignItems: 'flex-start' },
});
