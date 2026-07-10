import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import type { ListRenderItem } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetBackdrop,
  BottomSheetFooter,
  useBottomSheetSpringConfigs,
} from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps, BottomSheetFooterProps } from '@gorhom/bottom-sheet';
import Animated, {
  FadeInDown,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  ZoomIn,
  LinearTransition,
  interpolateColor,
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withSpring,
  withTiming,
  useReducedMotion,
  ReduceMotion,
} from 'react-native-reanimated';
import { listProducts, recordSale } from '../db/database';
import type { Product } from '../db/database';
import { useTheme } from '../theme/ThemeContext';
import { spacing, type, touch, radius } from '../theme';
import { formatNaira } from '../utils/format';
import PressableScale from '../components/PressableScale';
import Toast from '../components/Toast';
import SuccessOverlay from '../components/SuccessOverlay';
import EmptyState from '../components/EmptyState';
import { GreetingHeader } from '../components/ScreenHeader';
import type { RootTabParamList } from '../navigation/types';

// Fat-finger protection: confirm before recording unusually large sales.
const LARGE_SALE_THRESHOLD = 500000;
const STAGGER_CAP = 10;
const POP_SPRING = { damping: 12, stiffness: 400 };

type SellScreenProps = BottomTabScreenProps<RootTabParamList, 'Sell'>;

interface CartLine {
  product: Product;
  qty: number;
}

interface ProductCardProps {
  item: Product;
  inCart: number;
  onAdd: (product: Product) => boolean;
  index: number;
}

function ProductCard({ item, inCart, onAdd, index }: ProductCardProps) {
  const { colors, elevation } = useTheme();
  const reduceMotion = useReducedMotion();
  const out = item.stock_qty <= 0;
  const low = !out && item.stock_qty <= item.low_stock_threshold;

  // Tap feedback: 120ms accent border flash, and the qty badge pulses.
  const flash = useSharedValue(0);
  const flashStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(flash.value, [0, 1], [colors.border, colors.accent]),
  }));

  const badgeScale = useSharedValue(1);
  const prevQty = useRef(inCart);
  useEffect(() => {
    if (inCart > prevQty.current && prevQty.current > 0 && !reduceMotion) {
      badgeScale.value = withSequence(withSpring(1.2, POP_SPRING), withSpring(1, POP_SPRING));
    }
    prevQty.current = inCart;
  }, [inCart, reduceMotion, badgeScale]);
  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: badgeScale.value }] }));

  const handlePress = () => {
    const added = onAdd(item);
    if (added && !reduceMotion) {
      flash.value = withSequence(
        withTiming(1, { duration: 60 }),
        withTiming(0, { duration: 180 })
      );
    }
  };

  return (
    <Animated.View
      entering={
        reduceMotion
          ? undefined
          : FadeInDown.delay(Math.min(index, STAGGER_CAP) * 40).duration(250)
      }
      style={styles.gridItem}
    >
      <PressableScale
        onPress={handlePress}
        style={[
          styles.card,
          { backgroundColor: colors.raised },
          elevation,
          flashStyle,
          out && styles.cardOut,
        ]}
      >
        <Text numberOfLines={2} style={[styles.cardName, { color: colors.text }]}>
          {item.name}
        </Text>
        <Text style={[styles.cardPrice, { color: colors.primary }]}>
          {formatNaira(item.price)}
        </Text>
        <Text style={[styles.cardStock, { color: out || low ? colors.danger : colors.muted }]}>
          {out ? 'Out of stock' : `${item.stock_qty} left`}
        </Text>
        {inCart > 0 && (
          // Entering animation and animated transform must live on different
          // nodes, or the layout animation overwrites the transform (and
          // Reanimated warns): outer owns entering, inner owns the pulse.
          <Animated.View
            entering={reduceMotion ? undefined : ZoomIn.springify().damping(12)}
            style={styles.qtyBadgeWrap}
          >
            <Animated.View
              style={[styles.qtyBadge, { backgroundColor: colors.accent }, badgeStyle]}
            >
              <Text style={[styles.qtyBadgeText, { color: colors.onAccent }]}>{inCart}</Text>
            </Animated.View>
          </Animated.View>
        )}
      </PressableScale>
    </Animated.View>
  );
}

export default function SellScreen({ navigation }: SellScreenProps) {
  const { colors, elevation } = useTheme();
  const reduceMotion = useReducedMotion();
  const insets = useSafeAreaInsets();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<Record<number, number>>({}); // productId -> qty
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const sheetRef = useRef<BottomSheet>(null);

  const load = useCallback(async () => {
    try {
      const rows = await listProducts();
      setProducts(rows);
      setLoadError(null);
    } catch (e) {
      setLoadError("Couldn't load products. Close and reopen the app if this continues.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, search]);

  const cartLines = useMemo<CartLine[]>(
    () =>
      products
        .filter((p) => (cart[p.id] ?? 0) > 0)
        .map((p) => ({ product: p, qty: cart[p.id] })),
    [products, cart]
  );
  const cartCount = cartLines.reduce((sum, l) => sum + l.qty, 0);
  const cartTotal = cartLines.reduce((sum, l) => sum + l.qty * l.product.price, 0);

  // Total "pulses" each time an item lands in the cart — except the very
  // first add: the bar is mid-entering then, and a simultaneous transform
  // gets overwritten by the layout animation, freezing the text mid-scale.
  const pulse = useSharedValue(1);
  const prevTotal = useRef(0);
  useEffect(() => {
    if (cartTotal > prevTotal.current && prevTotal.current > 0 && !reduceMotion) {
      pulse.value = withSequence(
        withTiming(1.15, { duration: 100 }),
        withTiming(1, { duration: 130 })
      );
    }
    prevTotal.current = cartTotal;
  }, [cartTotal, reduceMotion, pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  // If the cart empties from inside the sheet, the sheet has nothing to show.
  useEffect(() => {
    if (cartLines.length === 0) sheetRef.current?.close();
  }, [cartLines.length]);

  // Snappy sheet physics: high damping so it settles without wobbling.
  const sheetAnimation = useBottomSheetSpringConfigs({
    damping: 30,
    stiffness: 400,
    mass: 1,
  });

  const addToCart = (product: Product): boolean => {
    if (product.stock_qty <= 0) {
      setToast('Out of stock');
      return false;
    }
    const current = cart[product.id] || 0;
    if (current >= product.stock_qty) {
      setToast(`Only ${product.stock_qty} in stock`);
      return false;
    }
    setCart({ ...cart, [product.id]: current + 1 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    return true;
  };

  const changeQty = (product: Product, delta: number) => {
    const current = cart[product.id] || 0;
    const next = current + delta;
    if (delta > 0 && next > product.stock_qty) return;
    const nextCart = { ...cart };
    if (next <= 0) delete nextCart[product.id];
    else nextCart[product.id] = next;
    setCart(nextCart);
  };

  const removeLine = (product: Product) => {
    const nextCart = { ...cart };
    delete nextCart[product.id];
    setCart(nextCart);
  };

  const completeSale = () => {
    const doRecord = async () => {
      setSubmitting(true);
      try {
        const { total } = await recordSale(
          cartLines.map((l) => ({ productId: l.product.id, qty: l.qty }))
        );
        setCart({});
        sheetRef.current?.close();
        setSuccess(`Sale recorded — ${formatNaira(total)}`);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } catch (e) {
        Alert.alert(
          'Sale not recorded',
          e instanceof Error && e.message ? e.message : 'Something went wrong. Please try again.'
        );
      } finally {
        setSubmitting(false);
        load();
      }
    };
    if (cartTotal > LARGE_SALE_THRESHOLD) {
      Alert.alert('Large sale', `This sale is ${formatNaira(cartTotal)}. Record it?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes, record it', onPress: doRecord },
      ]);
    } else {
      doRecord();
    }
  };

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
        style={[props.style, { backgroundColor: colors.overlay }]}
      />
    ),
    [colors.overlay]
  );

  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props} bottomInset={insets.bottom + spacing.md}>
        <View style={styles.footerWrap}>
          <PressableScale
            disabled={submitting}
            onPress={completeSale}
            style={[styles.completeBtn, { backgroundColor: colors.primary }]}
          >
            {submitting ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={[styles.completeBtnText, { color: colors.onPrimary }]}>
                Complete Sale — {formatNaira(cartTotal)}
              </Text>
            )}
          </PressableScale>
        </View>
      </BottomSheetFooter>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [insets.bottom, submitting, cartTotal, cartLines, colors]
  );

  const renderProduct: ListRenderItem<Product> = ({ item, index }) => (
    <ProductCard item={item} inCart={cart[item.id] || 0} onAdd={addToCart} index={index} />
  );

  if (!loading && products.length === 0 && !loadError) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <GreetingHeader />
        <EmptyState
          emoji="🏪"
          title="No products yet"
          subtitle="Add what you sell, then record sales in seconds."
          actionLabel="Add your first product"
          onAction={() => navigation.navigate('Stock')}
        />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <GreetingHeader />
      <View style={styles.searchWrap}>
        <View style={[styles.searchPill, { backgroundColor: colors.raised }, elevation]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search products…"
            placeholderTextColor={colors.muted}
            style={[styles.searchInput, { color: colors.text }]}
            returnKeyType="search"
          />
        </View>
      </View>

      {loadError ? (
        <EmptyState emoji="⚠️" title="Something went wrong" subtitle={loadError} actionLabel="Try again" onAction={load} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderProduct}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.gridContent}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={[styles.noResults, { color: colors.muted }]}>
              No products match “{search.trim()}”
            </Text>
          }
        />
      )}

      {cartCount > 0 && (
        <Animated.View
          entering={reduceMotion ? undefined : SlideInDown.springify().damping(18)}
          exiting={reduceMotion ? undefined : SlideOutDown.duration(200)}
          style={styles.cartBarWrap}
        >
          <PressableScale
            onPress={() => sheetRef.current?.snapToIndex(0)}
            scaleTo={0.98}
            style={[styles.cartBar, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.cartBarCount, { color: colors.onPrimary }]}>
              {cartCount} {cartCount === 1 ? 'item' : 'items'} ▸
            </Text>
            {/* Pulse the wrapper, not the Text: Animated.Text doesn't re-measure
                when the amount grows a digit, which clips the last character. */}
            <Animated.View style={[styles.totalWrap, pulseStyle]}>
              <Text style={[styles.cartBarTotal, { color: colors.accent }]}>
                {formatNaira(cartTotal)}
              </Text>
            </Animated.View>
          </PressableScale>
        </Animated.View>
      )}

      {/* Plain in-screen BottomSheet, not BottomSheetModal: the modal renders
          through a portal at the provider, and on the new architecture the
          native screen containers can sit above it, so it never becomes
          visible. In-screen sheets have no portal to lose. */}
      <BottomSheet
        ref={sheetRef}
        index={-1}
        snapPoints={['50%', '90%']}
        enableDynamicSizing={false}
        enablePanDownToClose
        animationConfigs={sheetAnimation}
        // Phones with system animations off (common on budget Androids) map to
        // reduced motion, which leaves the sheet stuck off-screen. Opening the
        // cart is functional motion, so it must always run.
        overrideReduceMotion={ReduceMotion.Never}
        backdropComponent={renderBackdrop}
        footerComponent={renderFooter}
        backgroundStyle={[styles.sheetBg, { backgroundColor: colors.card }]}
        handleIndicatorStyle={{ backgroundColor: colors.border }}
      >
        <BottomSheetScrollView
          contentContainerStyle={[styles.sheetContent, { paddingBottom: insets.bottom + 120 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.sheetTitle, { color: colors.text }]}>Cart</Text>
          {cartLines.map(({ product, qty }) => {
            const atLimit = qty >= product.stock_qty;
            return (
              <Animated.View
                key={product.id}
                layout={reduceMotion ? undefined : LinearTransition.duration(200)}
                exiting={reduceMotion ? undefined : FadeOut.duration(150)}
                style={[styles.cartRow, { borderBottomColor: colors.border }]}
              >
                <View style={styles.cartRowInfo}>
                  <Text numberOfLines={1} style={[styles.cartRowName, { color: colors.text }]}>
                    {product.name}
                  </Text>
                  <Text style={[styles.cartRowPrice, { color: colors.muted }]}>
                    {formatNaira(product.price)} each
                  </Text>
                </View>
                <View style={styles.stepper}>
                  <PressableScale
                    onPress={() => changeQty(product, -1)}
                    style={[styles.stepBtn, { backgroundColor: colors.subtle }]}
                  >
                    <Text style={[styles.stepBtnText, { color: colors.text }]}>−</Text>
                  </PressableScale>
                  <Text style={[styles.stepQty, { color: colors.text }]}>{qty}</Text>
                  <PressableScale
                    onPress={() => changeQty(product, +1)}
                    disabled={atLimit}
                    style={[styles.stepBtn, { backgroundColor: colors.subtle }, atLimit && styles.stepBtnDisabled]}
                  >
                    <Text style={[styles.stepBtnText, { color: atLimit ? colors.muted : colors.text }]}>+</Text>
                  </PressableScale>
                </View>
                <Text style={[styles.lineTotal, { color: colors.text }]}>
                  {formatNaira(product.price * qty)}
                </Text>
                <PressableScale
                  onPress={() => removeLine(product)}
                  style={styles.removeBtn}
                  hitSlop={8}
                >
                  <Text style={[styles.removeText, { color: colors.danger }]}>✕</Text>
                </PressableScale>
              </Animated.View>
            );
          })}
          <View style={styles.sheetTotalRow}>
            <Text style={[styles.sheetTotalLabel, { color: colors.muted }]}>Total</Text>
            <Text style={[styles.sheetTotalValue, { color: colors.text }]}>
              {formatNaira(cartTotal)}
            </Text>
          </View>
        </BottomSheetScrollView>
      </BottomSheet>

      {toast && <Toast message={toast} onHide={() => setToast(null)} />}
      {success && <SuccessOverlay message={success} onDone={() => setSuccess(null)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  searchWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  searchPill: {
    height: 52,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchIcon: {
    fontSize: type.body,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: type.body,
  },
  gridRow: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  gridContent: {
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingBottom: 120, // room for the cart bar
  },
  gridItem: {
    flex: 1,
  },
  card: {
    minHeight: touch.minTarget + 44,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  cardOut: {
    opacity: 0.45,
  },
  cardName: {
    fontSize: type.cardName,
    fontWeight: '500',
  },
  cardPrice: {
    fontSize: type.price,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  cardStock: {
    fontSize: type.label,
    marginTop: spacing.xs,
  },
  qtyBadgeWrap: {
    position: 'absolute',
    top: -8,
    right: -8,
  },
  qtyBadge: {
    minWidth: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  qtyBadgeText: {
    fontSize: type.body,
    fontWeight: '800',
  },
  noResults: {
    textAlign: 'center',
    marginTop: spacing.xl,
    fontSize: type.body,
    paddingHorizontal: spacing.lg,
  },
  cartBarWrap: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
  },
  cartBar: {
    minHeight: touch.button,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 6,
  },
  cartBarCount: {
    fontSize: type.body,
    fontWeight: '700',
  },
  totalWrap: {
    flexShrink: 0, // the amount never gives up width — clipping money is worse than wrapping the label
  },
  cartBarTotal: {
    fontSize: type.price,
    fontWeight: '800',
  },
  sheetBg: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  sheetContent: {
    paddingHorizontal: spacing.lg,
  },
  sheetTitle: {
    fontSize: type.title,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  cartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  cartRowInfo: {
    flex: 1,
  },
  cartRowName: {
    fontSize: type.body,
    fontWeight: '600',
  },
  cartRowPrice: {
    fontSize: type.label,
    marginTop: 2,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: {
    opacity: 0.4,
  },
  stepBtnText: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 28,
  },
  stepQty: {
    fontSize: type.body,
    fontWeight: '800',
    minWidth: 28,
    textAlign: 'center',
  },
  lineTotal: {
    fontSize: type.body,
    fontWeight: '700',
    minWidth: 76,
    textAlign: 'right',
  },
  removeBtn: {
    width: 36,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: {
    fontSize: type.title,
    fontWeight: '700',
  },
  sheetTotalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
  },
  sheetTotalLabel: {
    fontSize: type.body,
    fontWeight: '600',
  },
  sheetTotalValue: {
    fontSize: type.hero,
    fontWeight: '800',
  },
  footerWrap: {
    paddingHorizontal: spacing.lg,
  },
  completeBtn: {
    height: touch.button,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeBtnText: {
    fontSize: 20,
    fontWeight: '800',
  },
});
