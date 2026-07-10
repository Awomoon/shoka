import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { spacing, type } from '../theme';
import { getGreeting, formatTodayLong } from '../utils/format';

interface ScreenHeaderProps {
  title: string;
  action?: React.ReactNode;
}

// Replaces the stock navigation header: screen title on the left,
// contextual action (theme toggle, "+ Add") on the right.
export default function ScreenHeader({ title, action }: ScreenHeaderProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + spacing.md }]}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

// The Sell header is a slim greeting row — the products are the stars.
export function GreetingHeader() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + spacing.md }]}>
      <View>
        <Text style={[styles.greeting, { color: colors.text }]}>{getGreeting()}</Text>
        <Text style={[styles.date, { color: colors.muted }]}>{formatTodayLong()}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  title: {
    fontSize: type.screenTitle,
    fontWeight: '700',
  },
  action: {
    marginLeft: spacing.md,
  },
  greeting: {
    fontSize: type.title,
    fontWeight: '700',
  },
  date: {
    fontSize: type.label,
    marginTop: 2,
  },
});
