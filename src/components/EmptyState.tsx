import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { spacing, type, touch, radius } from '../theme';
import PressableScale from './PressableScale';

interface EmptyStateProps {
  emoji: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

// Every empty state offers a next action.
export default function EmptyState({ emoji, title, subtitle, actionLabel, onAction }: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text> : null}
      {actionLabel ? (
        <PressableScale onPress={onAction} style={[styles.button, { backgroundColor: colors.primary }]}>
          <Text style={[styles.buttonText, { color: colors.onPrimary }]}>{actionLabel}</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: type.title,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: type.body,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  button: {
    marginTop: spacing.xl,
    minHeight: touch.minTarget,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: type.body,
    fontWeight: '700',
  },
});
