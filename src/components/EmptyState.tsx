import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { spacing, type, touch, radius } from '../theme';
import PressableScale from './PressableScale';

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  tone?: 'default' | 'danger';
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

// Every empty state offers a next action.
export default function EmptyState({
  icon,
  tone = 'default',
  title,
  subtitle,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const { colors } = useTheme();
  const circleBg = tone === 'danger' ? colors.subtle : colors.tint;
  const iconColor = tone === 'danger' ? colors.danger : colors.primary;
  return (
    <View style={styles.wrap}>
      <View style={[styles.iconCircle, { backgroundColor: circleBg }]}>
        <Ionicons name={icon} size={36} color={iconColor} />
      </View>
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
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
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
