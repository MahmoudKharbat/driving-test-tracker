import React, { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { colors, fontSize, radius, spacing } from '../theme';
import { strings } from '../strings';
import { ChevronDownIcon } from './icons';

/**
 * Shared primitives.
 *
 * Layout uses `flexDirection: 'row'` unqualified throughout. With RTL forced at
 * the native level (expo-localization `forcesRTL`), React Native flips row
 * direction and start/end padding itself, so writing `row-reverse` by hand here
 * would double-flip and silently break the layout.
 *
 * Text alignment is the exception: `textAlign: 'right'` is not inferred for
 * every case, so `AppText` sets it explicitly.
 */

export function AppText({
  children,
  style,
  weight = 'regular',
  size = 'md',
  color = colors.text,
  align = 'right',
  numberOfLines,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  weight?: 'regular' | 'medium' | 'bold';
  size?: keyof typeof fontSize;
  color?: string;
  align?: TextStyle['textAlign'];
  numberOfLines?: number;
}) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        {
          fontSize: fontSize[size],
          color,
          textAlign: align,
          writingDirection: 'rtl',
          fontWeight: weight === 'bold' ? '700' : weight === 'medium' ? '600' : '400',
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const isDisabled = disabled || loading;

  const bg =
    variant === 'primary'
      ? colors.primary
      : variant === 'danger'
        ? colors.fail
        : variant === 'secondary'
          ? colors.surface
          : 'transparent';

  // Filled variants take white text; outlined and ghost take the accent.
  const fg = variant === 'primary' || variant === 'danger' ? '#FFFFFF' : colors.primary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(isDisabled), busy: Boolean(loading) }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1 },
        variant === 'secondary' && styles.buttonBordered,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <AppText weight="bold" size="md" color={fg} align="center">
          {label}
        </AppText>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <AppText size="sm" weight="medium" color={colors.textMuted}>
        {label}
      </AppText>
      {children}
      {error ? (
        <AppText size="sm" color={colors.fail}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

export function TextField({
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize = 'none',
  autoFocus,
  onSubmitEditing,
  invalid,
  autoComplete,
  style,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'words';
  autoFocus?: boolean;
  onSubmitEditing?: () => void;
  invalid?: boolean;
  autoComplete?: 'email' | 'password' | 'name' | 'off';
  style?: StyleProp<TextStyle>;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textFaint}
      secureTextEntry={secureTextEntry}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      autoCorrect={false}
      autoFocus={autoFocus}
      onSubmitEditing={onSubmitEditing}
      autoComplete={autoComplete}
      style={[styles.input, invalid && styles.inputInvalid, style]}
    />
  );
}

/** A tappable row that opens a picker — the closed state of a dropdown. */
export function SelectRow({
  value,
  placeholder,
  onPress,
  disabled,
  invalid,
}: {
  value: string | null;
  placeholder: string;
  onPress: () => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.input,
        styles.selectRow,
        invalid && styles.inputInvalid,
        { opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
      ]}
    >
      <AppText
        size="md"
        color={value ? colors.text : colors.textFaint}
        style={styles.flex}
      >
        {value ?? placeholder}
      </AppText>
      <ChevronDownIcon size={18} color={colors.textMuted} />
    </Pressable>
  );
}

/**
 * Pass/fail selector.
 *
 * Two large targets rather than a switch: it is the last tap before saving, it
 * is pressed while standing beside a vehicle, and a mis-tap writes the wrong
 * outcome into the record the tester later relies on.
 */
export function PassFailToggle({
  value,
  onChange,
}: {
  value: 'pass' | 'fail' | null;
  onChange: (v: 'pass' | 'fail') => void;
}) {
  const option = (v: 'pass' | 'fail', label: string, on: string, faint: string) => {
    const selected = value === v;
    return (
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={label}
        onPress={() => onChange(v)}
        style={({ pressed }) => [
          styles.toggleOption,
          {
            backgroundColor: selected ? on : faint,
            borderColor: selected ? on : colors.border,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <AppText
          weight="bold"
          size="lg"
          align="center"
          color={selected ? '#FFFFFF' : on}
        >
          {label}
        </AppText>
      </Pressable>
    );
  };

  return (
    <View style={styles.toggleRow} accessibilityRole="radiogroup">
      {option('pass', strings.newTest.pass, colors.pass, colors.passFaint)}
      {option('fail', strings.newTest.fail, colors.fail, colors.failFaint)}
    </View>
  );
}

/**
 * Pass rate as a number, the raw fraction, and a bar — e.g. "83%  5/6".
 *
 * Replaces a red/amber/green pill whose colour thresholds were never explained
 * on screen. One accent colour; the bar length carries the comparison.
 */
export function PassRateMeter({
  passed,
  total,
  hasStats,
}: {
  passed: number;
  total: number;
  hasStats: boolean;
}) {
  if (!hasStats || total === 0) {
    return (
      <View style={styles.meter}>
        <AppText size="sm" color={colors.textFaint}>
          {strings.teachers.noTests}
        </AppText>
      </View>
    );
  }

  const rate = Math.round((passed / total) * 100);
  return (
    <View style={styles.meter}>
      <View style={styles.meterNumbers}>
        <AppText size="md" weight="bold">{`${rate}%`}</AppText>
        {/* LTR so "5/6" never renders as "6/5". */}
        <Text style={styles.meterFraction}>{`${passed}/${total}`}</Text>
      </View>
      <View style={styles.meterTrack}>
        <View style={[styles.meterFill, { width: `${rate}%` }]} />
      </View>
    </View>
  );
}

/** Two-or-more-way switch, e.g. מורה / עיר in the add sheet. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  labelFor,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  labelFor: (v: T) => string;
}) {
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {options.map((o) => {
        const selected = o === value;
        return (
          <Pressable
            key={o}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(o)}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            <AppText
              size="sm"
              weight={selected ? 'bold' : 'medium'}
              color={selected ? colors.text : colors.textMuted}
              align="center"
            >
              {labelFor(o)}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Non-interactive label, e.g. an existing city. Deliberately not a list row,
 *  so it does not look tappable. */
export function Tag({ label }: { label: string }) {
  return (
    <View style={styles.tag}>
      <AppText size="sm" color={colors.textMuted}>
        {label}
      </AppText>
    </View>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={styles.empty}>
      <AppText size="md" weight="medium" color={colors.textMuted} align="center">
        {title}
      </AppText>
      {hint ? (
        <AppText size="sm" color={colors.textFaint} align="center">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

export function Loading() {
  return (
    <View style={styles.empty}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  button: {
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  buttonBordered: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  field: {
    gap: spacing.sm,
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    fontSize: fontSize.md,
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  inputInvalid: {
    borderColor: colors.fail,
  },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  toggleOption: {
    flex: 1,
    minHeight: 64,
    borderRadius: radius.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meter: { width: 76, gap: spacing.xs },
  meterNumbers: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  meterFraction: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    writingDirection: 'ltr',
  },
  meterTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  meterFill: { height: 3, borderRadius: 2, backgroundColor: colors.primary },
  segmented: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segment: {
    flex: 1,
    minHeight: 38,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentSelected: {
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  tag: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  empty: {
    padding: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
  },
});
