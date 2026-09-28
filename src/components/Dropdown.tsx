import React, { useRef, useState, type ReactNode } from 'react';
import {
  Dimensions,
  I18nManager,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { colors, radius, spacing } from '../theme';
import { strings } from '../strings';
import { AppText } from './ui';
import { CheckIcon } from './icons';

const GAP = 6;
const MIN_WIDTH = 180;

/**
 * A small menu that opens under its trigger — for short option lists (sort,
 * city filter) where a full-screen sheet is more ceremony than the choice is
 * worth. Tapping outside closes it.
 *
 * The menu's start edge lines up with the trigger's start edge. Positions come
 * from `measureInWindow`, which is physical (left-origin); `start` is measured
 * from the right under RTL, so the offset is converted rather than using `left`,
 * which React Native would swap.
 */
export function Dropdown<T extends string>({
  options,
  selected,
  onSelect,
  labelFor,
  children,
}: {
  options: readonly T[];
  selected: T | null;
  onSelect: (value: T) => void;
  labelFor?: (value: T) => string;
  /** The trigger. Receives `open` to wire to its onPress. */
  children: (open: () => void) => ReactNode;
}) {
  const anchor = useRef<View>(null);
  const [pos, setPos] = useState<{ top: number; start: number } | null>(null);

  const open = () => {
    anchor.current?.measureInWindow((x, y, width, height) => {
      const screen = Dimensions.get('window').width;
      const start = I18nManager.isRTL ? screen - (x + width) : x;
      // Keep the menu on screen when the trigger sits near the far edge.
      const maxStart = screen - MIN_WIDTH - spacing.lg;
      setPos({ top: y + height + GAP, start: Math.max(spacing.lg, Math.min(start, maxStart)) });
    });
  };

  const close = () => setPos(null);

  return (
    <>
      <View ref={anchor} collapsable={false}>
        {children(open)}
      </View>

      <Modal
        visible={pos !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={close}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel={strings.common.close} />
        {pos ? (
          <View style={[styles.menu, { top: pos.top, start: pos.start }]}>
            <ScrollView bounces={false}>
              {options.map((o, i) => {
                const isSelected = o === selected;
                return (
                  <Pressable
                    key={o}
                    accessibilityRole="menuitem"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => {
                      onSelect(o);
                      close();
                    }}
                    style={({ pressed }) => [
                      styles.item,
                      i > 0 && styles.itemDivider,
                      pressed && { backgroundColor: colors.bg },
                    ]}
                  >
                    <AppText
                      size="md"
                      weight={isSelected ? 'bold' : 'regular'}
                      color={isSelected ? colors.primary : colors.text}
                      style={styles.itemLabel}
                    >
                      {labelFor ? labelFor(o) : o}
                    </AppText>
                    {isSelected ? <CheckIcon size={18} color={colors.primary} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  menu: {
    position: 'absolute',
    minWidth: MIN_WIDTH,
    maxHeight: '50%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 46,
  },
  itemDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  itemLabel: { flex: 1 },
});
