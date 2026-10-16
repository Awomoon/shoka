import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { spacing, type } from '../theme';
import type { ThemeMode } from '../theme';
import PressableScale from './PressableScale';

const NEXT: Record<ThemeMode, ThemeMode> = { system: 'light', light: 'dark', dark: 'system' };
const LABEL: Record<ThemeMode, string> = { system: 'System', light: 'Light', dark: 'Dark' };
const ICON: Record<ThemeMode, keyof typeof Ionicons.glyphMap> = {
  system: 'contrast-outline',
  light: 'sunny-outline',
  dark: 'moon-outline',
};

// Lives in Settings only — the Sell screen stays free of everything but selling.
export default function ThemeToggle() {
  const { colors, mode, setMode } = useTheme();
  return (
    <PressableScale
      onPress={() => setMode(NEXT[mode])}
      style={styles.button}
      hitSlop={8}
    >
      <Ionicons name={ICON[mode]} size={18} color={colors.text} />
      <Text style={[styles.label, { color: colors.text }]}>{LABEL[mode]}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  label: {
    fontSize: type.label + 2,
    fontWeight: '600',
  },
});
