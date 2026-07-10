import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet, useWindowDimensions } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  LinearTransition,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import {
  getTodaySummary,
  getWeekSummary,
  getTopProducts,
  getRecentSales,
  getLowStockProducts,
} from '../db/database';
import type { Product, SalesSummary, SaleWithItems, TopProduct } from '../db/database';
import { useTheme } from '../theme/ThemeContext';
import { spacing, type, radius, getTypeScale } from '../theme';
import { formatNaira, formatSaleTime } from '../utils/format';
import useCountUp from '../utils/useCountUp';
import PressableScale from '../components/PressableScale';
import EmptyState from '../components/EmptyState';
import ScreenHeader from '../components/ScreenHeader';
import ThemeToggle from '../components/ThemeToggle';

const EASE = Easing.out(Easing.cubic);

interface CardProps {
  children: React.ReactNode;
  index?: number;
  style?: StyleProp<ViewStyle>;
}

function Card({ children, index = 0, style }: CardProps) {
  const { colors, elevation } = useTheme();
  const reduceMotion = useReducedMotion();
  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn.delay(index * 40).duration(180)}
      style={[styles.card, { backgroundColor: colors.raised }, elevation, style]}
    >
      {children}
    </Animated.View>
  );
}

function SectionLabel({ children, color }: { children: React.ReactNode; color?: string }) {
  const { colors } = useTheme();
  return (
    <Text style={[styles.sectionLabel, { color: color || colors.muted }]}>{children}</Text>
  );
}

export default function ReportsScreen() {
  const { colors, elevation } = useTheme();
  const reduceMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const t = getTypeScale(width);

  const [today, setToday] = useState<SalesSummary | null>(null);
  const [week, setWeek] = useState<SalesSummary | null>(null);
  const [low, setLow] = useState<Product[]>([]);
  const [top, setTop] = useState<TopProduct[]>([]);
  const [recent, setRecent] = useState<SaleWithItems[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [focusKey, setFocusKey] = useState(0);

  const load = useCallback(async () => {
    try {
      const [t, w, l, tp, r] = await Promise.all([
        getTodaySummary(),
        getWeekSummary(),
        getLowStockProducts(),
        getTopProducts(7),
        getRecentSales(10),
      ]);
      setToday(t);
      setWeek(w);
      setLow(l);
      setTop(tp);
      setRecent(r);
      setLoadError(null);
    } catch (e) {
      setLoadError("Couldn't load reports. Pull down to try again.");
    }
  }, []);

  // Hero card lands first (fade + slight scale), then the revenue counts up.
  const heroIn = useSharedValue(1);
  useFocusEffect(
    useCallback(() => {
      load();
      setFocusKey((k) => k + 1);
      if (!reduceMotion) {
        heroIn.value = 0;
        heroIn.value = withTiming(1, { duration: 200, easing: EASE });
      }
    }, [load, reduceMotion, heroIn])
  );
  const heroStyle = useAnimatedStyle(() => ({
    opacity: heroIn.value,
    transform: [{ scale: 0.97 + 0.03 * heroIn.value }],
  }));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // One hero animation for the screen: today's revenue counts up.
  const heroRevenue = useCountUp(today ? today.revenue : 0, {
    duration: 600,
    delay: 150,
    enabled: !reduceMotion,
    restartKey: focusKey,
  });

  const maxTopQty = top.length > 0 ? Math.max(...top.map((p) => p.qtySold)) : 1;

  if (loadError) {
    return (
      <SafeAreaView
        edges={['top', 'left', 'right']}
        style={[styles.screen, { backgroundColor: colors.background }]}
      >
        <ScreenHeader title="Reports" action={<ThemeToggle />} />
        <EmptyState emoji="⚠️" title="Something went wrong" subtitle={loadError} actionLabel="Try again" onAction={load} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <ScreenHeader title="Reports" action={<ThemeToggle />} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.card}
          />
        }
      >
        {/* The one place color is spent loudly: today's money. */}
        <Animated.View
          style={[styles.card, styles.heroCard, { backgroundColor: colors.primary }, elevation, heroStyle]}
        >
          <SectionLabel color={colors.onPrimary}>TODAY</SectionLabel>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            style={[styles.hero, { color: colors.onPrimary, fontSize: t.hero }]}
          >
            {formatNaira(heroRevenue)}
          </Text>
          <View style={styles.statRow}>
            <Text style={[styles.stat, { color: colors.onPrimary }]}>
              {today ? today.salesCount : 0}{' '}
              <Text style={styles.heroStatLabel}>sales</Text>
            </Text>
            <Text style={[styles.stat, { color: colors.onPrimary }]}>
              {today ? today.itemsSold : 0}{' '}
              <Text style={styles.heroStatLabel}>items</Text>
            </Text>
          </View>
        </Animated.View>

        <Card index={1}>
          <SectionLabel>THIS WEEK</SectionLabel>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            style={[styles.weekRevenue, { color: colors.text, fontSize: t.price }]}
          >
            {formatNaira(week ? week.revenue : 0)}
          </Text>
          <View style={styles.statRow}>
            <Text style={[styles.stat, { color: colors.text }]}>
              {week ? week.salesCount : 0} <Text style={[styles.statLabel, { color: colors.muted }]}>sales</Text>
            </Text>
            <Text style={[styles.stat, { color: colors.text }]}>
              {week ? week.itemsSold : 0} <Text style={[styles.statLabel, { color: colors.muted }]}>items</Text>
            </Text>
          </View>
        </Card>

        <Card index={2}>
          <SectionLabel>RESTOCK LIST</SectionLabel>
          {low.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              Nothing is running low. 👍
            </Text>
          ) : (
            low.map((p) => (
              <View key={p.id} style={[styles.line, { borderBottomColor: colors.border }]}>
                <Text numberOfLines={1} style={[styles.lineName, { color: colors.text }]}>
                  {p.name}
                </Text>
                <View style={[styles.lowBadge, { backgroundColor: colors.danger }]}>
                  <Text style={[styles.lowBadgeText, { color: colors.onDanger }]}>
                    {p.stock_qty} left
                  </Text>
                </View>
              </View>
            ))
          )}
        </Card>

        <Card index={3}>
          <SectionLabel>TOP SELLERS — LAST 7 DAYS</SectionLabel>
          {top.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              No sales in the last 7 days yet.
            </Text>
          ) : (
            top.map((p, i) => (
              <View key={p.productId} style={styles.topRow}>
                {/* Relative-qty bar behind the row — plain View, no chart library. */}
                <View
                  style={[
                    styles.topBar,
                    {
                      backgroundColor: colors.tint,
                      width: `${Math.max(8, (p.qtySold / maxTopQty) * 100)}%` as const,
                    },
                  ]}
                />
                <View style={styles.topRowContent}>
                  <Text style={[styles.rank, { color: colors.muted }]}>{i + 1}</Text>
                  <Text numberOfLines={1} style={[styles.lineName, { color: colors.text }]}>
                    {p.name}
                  </Text>
                  <Text style={[styles.lineValue, { color: colors.text }]}>×{p.qtySold}</Text>
                </View>
              </View>
            ))
          )}
        </Card>

        <Card index={4}>
          <SectionLabel>RECENT SALES</SectionLabel>
          {recent.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              Sales you record will show here.
            </Text>
          ) : (
            recent.map((sale) => (
              <Animated.View
                key={sale.id}
                layout={reduceMotion ? undefined : LinearTransition.duration(200)}
                style={[styles.saleWrap, { borderBottomColor: colors.border }]}
              >
                <PressableScale
                  onPress={() => setExpanded(expanded === sale.id ? null : sale.id)}
                  scaleTo={0.98}
                  style={styles.saleRow}
                >
                  <View style={styles.saleInfo}>
                    <Text style={[styles.saleTime, { color: colors.muted }]}>
                      {formatSaleTime(sale.created_at)}
                    </Text>
                    <Text style={[styles.saleTotal, { color: colors.text }]}>
                      {formatNaira(sale.total)}
                    </Text>
                  </View>
                  <Text style={[styles.chevron, { color: colors.muted }]}>
                    {expanded === sale.id ? '▴' : '▾'}
                  </Text>
                </PressableScale>
                {expanded === sale.id &&
                  sale.items.map((it) => (
                    <View key={it.id} style={styles.saleItemRow}>
                      <Text numberOfLines={1} style={[styles.saleItemName, { color: colors.muted }]}>
                        {it.qty} × {it.product_name}
                      </Text>
                      <Text style={[styles.saleItemValue, { color: colors.muted }]}>
                        {formatNaira(it.qty * it.unit_price)}
                      </Text>
                    </View>
                  ))}
              </Animated.View>
            ))
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.xs,
    gap: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  heroCard: {
    paddingVertical: spacing.xl,
  },
  sectionLabel: {
    fontSize: type.label,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  hero: {
    fontWeight: '800',
  },
  heroStatLabel: {
    fontSize: type.body,
    fontWeight: '400',
    opacity: 0.75,
  },
  weekRevenue: {
    fontWeight: '800',
  },
  statRow: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.sm,
  },
  stat: {
    fontSize: type.body,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: type.body,
    fontWeight: '400',
  },
  emptyText: {
    fontSize: type.body,
    paddingVertical: spacing.sm,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    gap: spacing.md,
  },
  lineName: {
    flex: 1,
    fontSize: type.body,
    fontWeight: '600',
  },
  lineValue: {
    fontSize: type.body,
    fontWeight: '800',
  },
  rank: {
    fontSize: type.body,
    fontWeight: '700',
    minWidth: 20, // aligns ranks without a fixed width that could clip
  },
  topRow: {
    justifyContent: 'center',
    marginVertical: spacing.xs,
    minHeight: 44,
  },
  topBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: radius.sm,
  },
  topRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  lowBadge: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  lowBadgeText: {
    fontSize: type.label,
    fontWeight: '800',
  },
  saleWrap: {
    borderBottomWidth: 1,
    paddingBottom: spacing.xs,
  },
  saleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    minHeight: 56,
  },
  saleInfo: {
    flex: 1,
  },
  saleTime: {
    fontSize: type.label,
  },
  saleTotal: {
    fontSize: type.title,
    fontWeight: '800',
    marginTop: 2,
  },
  chevron: {
    fontSize: type.title,
    paddingHorizontal: spacing.sm,
  },
  saleItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
    paddingLeft: spacing.sm,
    gap: spacing.md,
  },
  saleItemName: {
    flex: 1,
    fontSize: type.body,
  },
  saleItemValue: {
    fontSize: type.body,
  },
});
