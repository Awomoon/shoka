import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { spacing, type } from '../theme';
import { getGreeting, formatTodayLong } from '../utils/format';

interface ScreenHeaderProps {
  title: string;
  action?: React.ReactNode;
}

// Replaces the stock navigation header: screen title on the left,
// contextual action (theme toggle, "+ Add") on the right.
// Screens wrap themselves in SafeAreaView, so no inset handling here.
export default function ScreenHeader({ title, action }: ScreenHeaderProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.bar}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

// The Sell header is a slim greeting row — the products are the stars.
// Once a shop name is set in Settings, it replaces the generic greeting.
export function GreetingHeader({ shopName }: { shopName?: string | null }) {
  const { colors } = useTheme();
  return (
    <View style={styles.bar}>
      <View>
        <Text numberOfLines={1} style={[styles.greeting, { color: colors.text }]}>
          {shopName || getGreeting()}
        </Text>
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
    paddingTop: spacing.md,
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
