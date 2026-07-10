import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { spacing, type } from '../theme';
import type { ThemeMode } from '../theme';
import PressableScale from './PressableScale';

const NEXT: Record<ThemeMode, ThemeMode> = { system: 'light', light: 'dark', dark: 'system' };
const LABEL: Record<ThemeMode, string> = { system: '🌓 System', light: '☀️ Light', dark: '🌙 Dark' };

// Lives in the Reports header only — the Sell screen stays free of everything but selling.
export default function ThemeToggle() {
  const { colors, mode, setMode } = useTheme();
  return (
    <PressableScale
      onPress={() => setMode(NEXT[mode])}
      style={styles.button}
      hitSlop={8}
    >
      <Text style={[styles.label, { color: colors.text }]}>{LABEL[mode]}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  label: {
    fontSize: type.label + 2,
    fontWeight: '600',
  },
});
