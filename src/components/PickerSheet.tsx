import React from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '../theme';
import { strings } from '../strings';
import { AppText } from './ui';

/** Generic single-choice list in a modal. Used for the city dropdown and the
 *  sort selector — anywhere the options are short and known. */
export function PickerSheet<T extends string>({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
  labelFor,
}: {
  visible: boolean;
  title: string;
  options: readonly T[];
  selected: T | null;
  onSelect: (value: T) => void;
  onClose: () => void;
  labelFor?: (value: T) => string;
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.sheet} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <AppText size="lg" weight="bold" style={styles.headerTitle}>
            {title}
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={strings.common.close}
            onPress={onClose}
            hitSlop={12}
          >
            <AppText size="md" weight="medium" color={colors.primary}>
              {strings.common.close}
            </AppText>
          </Pressable>
        </View>

        <FlatList
          data={options}
          keyExtractor={(item) => item}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const isSelected = item === selected;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
                style={({ pressed }) => [
                  styles.row,
                  pressed && { backgroundColor: colors.bg },
                ]}
              >
                <AppText
                  size="md"
                  weight={isSelected ? 'bold' : 'regular'}
                  color={isSelected ? colors.primary : colors.text}
                  style={styles.rowLabel}
                >
                  {labelFor ? labelFor(item) : item}
                </AppText>
                {isSelected ? (
                  <AppText size="md" color={colors.primary}>
                    ✓
                  </AppText>
                ) : null}
              </Pressable>
            );
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  headerTitle: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.md,
    minHeight: 56,
  },
  rowLabel: { flex: 1 },
});
