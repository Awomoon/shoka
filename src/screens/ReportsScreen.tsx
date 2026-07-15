import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Alert, Share, StyleSheet, useWindowDimensions } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
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
  getSetting,
  voidSale,
} from '../db/database';
import type { Product, SalesSummary, SaleWithItems, TopProduct } from '../db/database';
import { useTheme } from '../theme/ThemeContext';
import { spacing, type, radius, getTypeScale } from '../theme';
import { formatNaira, formatSaleTime, formatTodayLong } from '../utils/format';
import useCountUp from '../utils/useCountUp';
import PressableScale from '../components/PressableScale';
import Toast from '../components/Toast';
import EmptyState from '../components/EmptyState';
import ScreenHeader from '../components/ScreenHeader';
import type { RootStackParamList } from '../navigation/types';

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
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const settingsAction = (
    <PressableScale
      onPress={() => navigation.navigate('Settings')}
      style={styles.gearBtn}
      hitSlop={8}
    >
      <Text style={styles.gearIcon}>⚙️</Text>
    </PressableScale>
  );

  const [today, setToday] = useState<SalesSummary | null>(null);
  const [week, setWeek] = useState<SalesSummary | null>(null);
  const [low, setLow] = useState<Product[]>([]);
  const [top, setTop] = useState<TopProduct[]>([]);
  const [recent, setRecent] = useState<SaleWithItems[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [focusKey, setFocusKey] = useState(0);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

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
    getSetting('lastBackupAt')
      .then(setLastBackupAt)
      .catch(() => {});
  }, []);

  // Gentle nudge, never blocking: shown once there are sales worth losing and
  // the last backup is missing or older than 7 days.
  const backupAgeDays = lastBackupAt
    ? Math.floor((Date.now() - new Date(lastBackupAt).getTime()) / (24 * 60 * 60 * 1000))
    : null;
  const backupStale = recent.length > 0 && (backupAgeDays === null || backupAgeDays > 7);

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

  // Plain-text daily summary for WhatsApp — fresh numbers fetched at tap
  // time, voided sales already excluded by the queries. Works honestly on a
  // zero-sale day too.
  const shareSummary = async () => {
    try {
      const [shopName, t, topToday, lowNow] = await Promise.all([
        getSetting('shopName'),
        getTodaySummary(),
        getTopProducts(1),
        getLowStockProducts(),
      ]);
      const topLine = topToday.length > 0 ? `${topToday[0].name} ×${topToday[0].qtySold}` : '—';
      const lowLine = lowNow.length > 0 ? lowNow.map((p) => p.name).join(', ') : 'None';
      const message = [
        `📊 ${shopName || 'Shoka'} — Daily Summary`,
        `${formatTodayLong()} ${new Date().getFullYear()}`,
        `💰 Sales: ${formatNaira(t.revenue)}`,
        `🧾 Transactions: ${t.salesCount}`,
        `📦 Items sold: ${t.itemsSold}`,
        `🔝 Top item: ${topLine}`,
        `⚠️ Low stock: ${lowLine}`,
        '— via Shoka by Moontech',
      ].join('\n');
      await Share.share({ message });
    } catch (e) {
      Alert.alert("Couldn't share", 'The summary could not be shared. Please try again.');
    }
  };

  // Mistakes happen at the counter: void puts the items back in stock and
  // takes the sale out of every total, but keeps it visible in history.
  const confirmVoid = (sale: SaleWithItems) => {
    Alert.alert(
      'Void this sale?',
      `${formatNaira(sale.total)} comes out of your figures and the items go back into stock. The sale stays in the list, marked VOIDED.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Void sale',
          style: 'destructive',
          onPress: async () => {
            try {
              await voidSale(sale.id);
              setToast('Sale voided — stock restored');
              load();
            } catch (e) {
              Alert.alert(
                'Not voided',
                e instanceof Error && e.message ? e.message : 'The sale could not be voided. Please try again.'
              );
              load();
            }
          },
        },
      ]
    );
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
        <ScreenHeader title="Reports" action={settingsAction} />
        <EmptyState emoji="⚠️" title="Something went wrong" subtitle={loadError} actionLabel="Try again" onAction={load} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <ScreenHeader title="Reports" action={settingsAction} />
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
        {backupStale && (
          <PressableScale
            onPress={() => navigation.navigate('Settings')}
            style={[styles.backupBanner, { backgroundColor: colors.subtle }]}
          >
            <Text style={[styles.backupBannerText, { color: colors.muted }]}>
              💾{' '}
              {backupAgeDays === null
                ? 'No backup yet — your records live only on this phone.'
                : `Last backup was ${backupAgeDays} days ago.`}{' '}
              <Text style={{ color: colors.primary, fontWeight: '700' }}>Back up now</Text>
            </Text>
          </PressableScale>
        )}

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

        <PressableScale
          onPress={shareSummary}
          style={[styles.shareBtn, { backgroundColor: colors.raised }, elevation]}
        >
          <Text style={[styles.shareBtnText, { color: colors.primary }]}>
            📤 Share today's summary
          </Text>
        </PressableScale>

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
            recent.map((sale) => {
              const voided = sale.voided_at !== null;
              return (
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
                    <View style={[styles.saleInfo, voided && styles.voidedDim]}>
                      <Text style={[styles.saleTime, { color: colors.muted }]}>
                        {formatSaleTime(sale.created_at)}
                      </Text>
                      <View style={styles.saleTotalRow}>
                        <Text
                          style={[
                            styles.saleTotal,
                            { color: colors.text },
                            voided && styles.voidedTotal,
                          ]}
                        >
                          {formatNaira(sale.total)}
                        </Text>
                        {voided && (
                          <View style={[styles.voidedChip, { backgroundColor: colors.subtle }]}>
                            <Text style={[styles.voidedChipText, { color: colors.muted }]}>
                              VOIDED
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <Text style={[styles.chevron, { color: colors.muted }]}>
                      {expanded === sale.id ? '▴' : '▾'}
                    </Text>
                  </PressableScale>
                  {expanded === sale.id && (
                    <View style={voided ? styles.voidedDim : null}>
                      {sale.items.map((it) => (
                        <View key={it.id} style={styles.saleItemRow}>
                          <Text numberOfLines={1} style={[styles.saleItemName, { color: colors.muted }]}>
                            {it.qty} × {it.product_name}
                          </Text>
                          <Text style={[styles.saleItemValue, { color: colors.muted }]}>
                            {formatNaira(it.qty * it.unit_price)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {expanded === sale.id && !voided && (
                    <PressableScale onPress={() => confirmVoid(sale)} style={styles.voidBtn}>
                      <Text style={[styles.voidBtnText, { color: colors.danger }]}>
                        Void this sale
                      </Text>
                    </PressableScale>
                  )}
                </Animated.View>
              );
            })
          )}
        </Card>
      </ScrollView>
      {toast && <Toast message={toast} onHide={() => setToast(null)} bottom={24} />}
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
  gearBtn: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearIcon: {
    fontSize: 20,
  },
  backupBanner: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  shareBtn: {
    minHeight: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtnText: {
    fontSize: type.body,
    fontWeight: '700',
  },
  backupBannerText: {
    fontSize: type.label,
    lineHeight: 18,
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
  saleTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  voidedDim: {
    opacity: 0.5,
  },
  voidedTotal: {
    textDecorationLine: 'line-through',
  },
  voidedChip: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  voidedChipText: {
    fontSize: type.small,
    fontWeight: '800',
    letterSpacing: 1,
  },
  voidBtn: {
    minHeight: 44,
    justifyContent: 'center',
    paddingLeft: spacing.sm,
    marginBottom: spacing.xs,
  },
  voidBtnText: {
    fontSize: type.label,
    fontWeight: '700',
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
