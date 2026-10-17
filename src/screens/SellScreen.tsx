import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Alert,
  ActivityIndicator,
  Share,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import type { ListRenderItem } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetBackdrop,
  BottomSheetFooter,
  useBottomSheetTimingConfigs,
} from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps, BottomSheetFooterProps } from '@gorhom/bottom-sheet';
import Animated, {
  FadeIn,
  FadeInUp,
  FadeOut,
  FadeOutDown,
  LinearTransition,
  interpolateColor,
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  Easing,
  useReducedMotion,
  ReduceMotion,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import {
  listProducts,
  recordSale,
  getSetting,
  setSetting,
  getCreditCustomers,
  getRecentSaleCounts,
} from '../db/database';
import type { Product, SaleWithItems } from '../db/database';
import { useTheme } from '../theme/ThemeContext';
import { spacing, type, touch, radius, getTypeScale } from '../theme';
import { formatNaira } from '../utils/format';
import { buildReceiptText, nowSqlite } from '../utils/receipt';
import { notifyLowStock } from '../utils/notifications';
import PressableScale from '../components/PressableScale';
import Toast from '../components/Toast';
import SuccessOverlay from '../components/SuccessOverlay';
import EmptyState from '../components/EmptyState';
import { GreetingHeader } from '../components/ScreenHeader';
import { QuantityPad, PriceEditor, CreditCustomerPrompt } from '../components/SaleDialogs';
import type { RootTabParamList } from '../navigation/types';

// Fat-finger protection: confirm before recording unusually large sales.
const LARGE_SALE_THRESHOLD = 500000;
const STAGGER_CAP = 8;
const EASE = Easing.out(Easing.cubic);

type SellScreenProps = BottomTabScreenProps<RootTabParamList, 'Sell'>;

interface CartLine {
  product: Product;
  qty: number;
}

interface ToastState {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface ProductCardProps {
  item: Product;
  inCart: number;
  onAdd: (product: Product) => boolean;
  onLongPress: (product: Product) => void;
  index: number;
}

function ProductCard({ item, inCart, onAdd, onLongPress, index }: ProductCardProps) {
  const { colors, elevation } = useTheme();
  const reduceMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const t = getTypeScale(width);
  const out = item.stock_qty <= 0;
  const low = !out && item.stock_qty <= item.low_stock_threshold;

  // Tap feedback: 120ms accent border flash, and the qty badge dips.
  const flash = useSharedValue(0);
  const flashStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(flash.value, [0, 1], [colors.border, colors.accent]),
  }));

  // Opacity dip on increment — no transform, so nothing for the badge's
  // entering animation to fight.
  const badgeDip = useSharedValue(1);
  const prevQty = useRef(inCart);
  useEffect(() => {
    if (inCart > prevQty.current && prevQty.current > 0 && !reduceMotion) {
      badgeDip.value = withSequence(
        withTiming(0.4, { duration: 75, easing: EASE }),
        withTiming(1, { duration: 75, easing: EASE })
      );
    }
    prevQty.current = inCart;
  }, [inCart, reduceMotion, badgeDip]);
  const badgeDipStyle = useAnimatedStyle(() => ({ opacity: badgeDip.value }));

  const handlePress = () => {
    const added = onAdd(item);
    if (added && !reduceMotion) {
      flash.value = withSequence(
        withTiming(1, { duration: 60, easing: EASE }),
        withTiming(0, { duration: 180, easing: EASE })
      );
    }
  };

  return (
    <Animated.View
      entering={
        reduceMotion
          ? undefined
          : FadeIn.delay(Math.min(index, STAGGER_CAP) * 40).duration(180)
      }
      style={styles.gridItem}
    >
      <PressableScale
        onPress={handlePress}
        onLongPress={() => onLongPress(item)}
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
        <Text style={[styles.cardPrice, { color: colors.primary, fontSize: t.price }]}>
          {formatNaira(item.price)}
        </Text>
        <Text style={[styles.cardStock, { color: out || low ? colors.danger : colors.muted }]}>
          {out ? 'Out of stock' : `${item.stock_qty} left`}
        </Text>
        {inCart > 0 && (
          // Entering animation and the dip live on different nodes so the
          // layout animation never overwrites the animated style.
          <Animated.View
            entering={reduceMotion ? undefined : FadeIn.duration(150)}
            style={styles.qtyBadgeWrap}
          >
            <Animated.View
              style={[styles.qtyBadge, { backgroundColor: colors.accent }, badgeDipStyle]}
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
  const { width } = useWindowDimensions();
  const t = getTypeScale(width);

  // 2 columns on narrow phones, 3 when there's room.
  const numColumns = width < 400 ? 2 : 3;

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<Record<number, number>>({}); // productId -> qty
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  // Units sold per product in the last 7 days — refreshed on focus only, so
  // the grid never reshuffles mid-queue while sales are being rung up.
  const [saleCounts, setSaleCounts] = useState<Record<number, number>>({});
  // Checkout happens inside the sheet: cart view, then a branded confirm step.
  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'confirm'>('cart');
  const [success, setSuccess] = useState<string | null>(null);
  const [receiptText, setReceiptText] = useState<string | null>(null);
  const [shopName, setShopName] = useState<string | null>(null);

  // Per-sale price overrides (haggling): productId -> charged price.
  // The product's stored price is never changed from the cart.
  const [priceOverrides, setPriceOverrides] = useState<Record<number, number>>({});
  const [qtyPadProduct, setQtyPadProduct] = useState<Product | null>(null);
  const [priceEditProduct, setPriceEditProduct] = useState<Product | null>(null);
  const [creditPromptVisible, setCreditPromptVisible] = useState(false);
  const [creditSuggestions, setCreditSuggestions] = useState<string[]>([]);

  const sheetRef = useRef<BottomSheet>(null);

  const priceFor = (p: Product) => priceOverrides[p.id] ?? p.price;

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
    getSetting('shopName')
      .then(setShopName)
      .catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      getRecentSaleCounts()
        .then((rows) => {
          const map: Record<number, number> = {};
          for (const r of rows) map[r.productId] = r.qtySold;
          setSaleCounts(map);
        })
        .catch(() => {});
    }, [load])
  );

  // One-time long-press tip: loaded once, shown at the moment it's useful.
  const tipShownRef = useRef(false);
  const rapidTapRef = useRef({ id: 0, count: 0, at: 0 });
  useEffect(() => {
    getSetting('seenQtyTip')
      .then((v) => {
        if (v === '1') tipShownRef.current = true;
      })
      .catch(() => {});
  }, []);

  // What actually sells floats to the top; ties and new products fall back to
  // alphabetical, so the order stays predictable.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q ? products.filter((p) => p.name.toLowerCase().includes(q)) : products;
    return [...base].sort((a, b) => {
      const byCount = (saleCounts[b.id] ?? 0) - (saleCounts[a.id] ?? 0);
      if (byCount !== 0) return byCount;
      return a.name.localeCompare(b.name);
    });
  }, [products, search, saleCounts]);

  const cartLines = useMemo<CartLine[]>(
    () =>
      products
        .filter((p) => (cart[p.id] ?? 0) > 0)
        .map((p) => ({ product: p, qty: cart[p.id] })),
    [products, cart]
  );
  const cartCount = cartLines.reduce((sum, l) => sum + l.qty, 0);
  const cartTotal = cartLines.reduce((sum, l) => sum + l.qty * priceFor(l.product), 0);

  // The total dips (1 → 0.4 → 1 opacity, 150ms) as the number updates —
  // subtle, no transform, nothing for layout animations to overwrite.
  // Skipped on the first add: the bar is fading in then anyway.
  const totalDip = useSharedValue(1);
  const prevTotal = useRef(0);
  useEffect(() => {
    if (cartTotal !== prevTotal.current && prevTotal.current > 0 && !reduceMotion) {
      totalDip.value = withSequence(
        withTiming(0.4, { duration: 75, easing: EASE }),
        withTiming(1, { duration: 75, easing: EASE })
      );
    }
    prevTotal.current = cartTotal;
  }, [cartTotal, reduceMotion, totalDip]);
  const totalDipStyle = useAnimatedStyle(() => ({ opacity: totalDip.value }));

  // If the cart empties from inside the sheet, the sheet has nothing to show.
  useEffect(() => {
    if (cartLines.length === 0) sheetRef.current?.close();
  }, [cartLines.length]);

  // Smooth timing sheet — same cubic ease as everything else, no spring.
  const sheetAnimation = useBottomSheetTimingConfigs({
    duration: 250,
    easing: EASE,
  });

  const addToCart = (product: Product, qty = 1): boolean => {
    if (product.stock_qty <= 0) {
      setToast({ message: 'Out of stock' });
      return false;
    }
    const current = cart[product.id] || 0;
    if (current + qty > product.stock_qty) {
      setToast({ message: `Only ${product.stock_qty} in stock` });
      return false;
    }
    setCart({ ...cart, [product.id]: current + qty });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    // Teach the long-press quantity pad exactly when it's needed: on the 4th
    // rapid tap of the same product. Shown once, ever.
    if (qty === 1 && !tipShownRef.current) {
      const now = Date.now();
      const tap = rapidTapRef.current;
      if (tap.id === product.id && now - tap.at < 4000) {
        tap.count += 1;
      } else {
        tap.id = product.id;
        tap.count = 1;
      }
      tap.at = now;
      if (tap.count >= 4) {
        tipShownRef.current = true;
        setToast({ message: 'Tip: press and hold a product to type a quantity' });
        setSetting('seenQtyTip', '1').catch(() => {});
      }
    }
    return true;
  };

  // Long-press quantity entry: sell 10 of something in one gesture.
  const openQtyPad = (product: Product) => {
    if (product.stock_qty <= 0) {
      setToast({ message: 'Out of stock' });
      return;
    }
    if ((cart[product.id] || 0) >= product.stock_qty) {
      setToast({ message: `Only ${product.stock_qty} in stock` });
      return;
    }
    setQtyPadProduct(product);
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
    const removedQty = cart[product.id] || 0;
    const removedOverride = priceOverrides[product.id];
    const nextCart = { ...cart };
    delete nextCart[product.id];
    setCart(nextCart);
    const nextOverrides = { ...priceOverrides };
    delete nextOverrides[product.id];
    setPriceOverrides(nextOverrides);
    // A mis-tapped ✕ shouldn't cost a re-negotiated price: undo restores the
    // quantity and any haggled price. Stock was never touched, so it's safe.
    if (removedQty > 0) {
      setToast({
        message: `${product.name} removed`,
        actionLabel: 'Undo',
        onAction: () => {
          setCart((c) => ({ ...c, [product.id]: removedQty }));
          if (removedOverride !== undefined) {
            setPriceOverrides((o) => ({ ...o, [product.id]: removedOverride }));
          }
        },
      });
    }
  };

  const doRecord = async (isCredit: boolean, customerName?: string) => {
    setSubmitting(true);
    const linesSnapshot = cartLines.map((l) => ({
      product: l.product,
      qty: l.qty,
      charged: priceFor(l.product),
    }));
    try {
      const { saleId, total } = await recordSale(
        linesSnapshot.map((l) => ({
          productId: l.product.id,
          qty: l.qty,
          unitPrice: priceOverrides[l.product.id],
        })),
        { isCredit, customerName }
      );
      // Receipt built from the snapshot so it's ready before any re-query.
      const saleForReceipt: SaleWithItems = {
        id: saleId,
        total,
        created_at: nowSqlite(),
        voided_at: null,
        is_credit: isCredit ? 1 : 0,
        customer_name: isCredit ? customerName ?? null : null,
        paid_at: null,
        items: linesSnapshot.map((l, i) => ({
          id: i,
          sale_id: saleId,
          product_id: l.product.id,
          product_name: l.product.name,
          unit_price: l.charged,
          list_price: l.product.price,
          qty: l.qty,
        })),
      };
      setReceiptText(buildReceiptText(shopName, saleForReceipt));
      setCart({});
      setPriceOverrides({});
      sheetRef.current?.close();
      setSuccess(
        isCredit
          ? `On credit — ${customerName} owes ${formatNaira(total)}`
          : `Sale recorded — ${formatNaira(total)}`
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      // Tray alert for items this sale pushed to/below their threshold —
      // only when the owner opted in, and never blocking the sale flow.
      getSetting('notifyLowStock')
        .then((enabled) => {
          if (enabled !== '1') return;
          const crossed = linesSnapshot
            .filter(
              (l) =>
                l.product.stock_qty > l.product.low_stock_threshold &&
                l.product.stock_qty - l.qty <= l.product.low_stock_threshold
            )
            .map((l) => ({ ...l.product, stock_qty: l.product.stock_qty - l.qty }));
          if (crossed.length > 0) return notifyLowStock(crossed);
        })
        .catch(() => {});
    } catch (e) {
      Alert.alert(
        'Sale not recorded',
        e instanceof Error && e.message ? e.message : 'Something went wrong. Please try again.'
      );
    } finally {
      setSubmitting(false);
      setCheckoutStep('cart');
      load();
    }
  };

  const openCreditPrompt = () => {
    getCreditCustomers()
      .then(setCreditSuggestions)
      .catch(() => setCreditSuggestions([]));
    setCreditPromptVisible(true);
  };

  // Checkout step 1: switch the sheet to the branded confirm view. The old
  // flow stacked system alerts here; the in-sheet step keeps the brand at the
  // most important moment, makes "Paid" the one big obvious action, and shows
  // the large-sale safeguard inline (plus a warning haptic) — still an
  // explicit, deliberate confirmation before anything is recorded.
  const completeSale = () => {
    if (cartLines.length === 0) return;
    setCheckoutStep('confirm');
    if (cartTotal > LARGE_SALE_THRESHOLD) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
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
          {checkoutStep === 'cart' ? (
            <PressableScale
              disabled={submitting}
              onPress={completeSale}
              style={[styles.completeBtn, { backgroundColor: colors.primary }]}
            >
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                style={[styles.completeBtnText, { color: colors.onPrimary }]}
              >
                Complete Sale — {formatNaira(cartTotal)}
              </Text>
            </PressableScale>
          ) : (
            <>
              <PressableScale
                disabled={submitting}
                onPress={() => doRecord(false)}
                style={[styles.completeBtn, { backgroundColor: colors.primary }]}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                    style={[styles.completeBtnText, { color: colors.onPrimary }]}
                  >
                    Paid — record sale
                  </Text>
                )}
              </PressableScale>
              <PressableScale
                disabled={submitting}
                onPress={openCreditPrompt}
                style={[styles.creditBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
              >
                <Text style={[styles.creditBtnText, { color: colors.text }]}>On credit…</Text>
              </PressableScale>
            </>
          )}
        </View>
      </BottomSheetFooter>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [insets.bottom, submitting, cartTotal, cartLines, colors, checkoutStep]
  );

  const renderProduct: ListRenderItem<Product> = ({ item, index }) => (
    <ProductCard
      item={item}
      inCart={cart[item.id] || 0}
      onAdd={addToCart}
      onLongPress={openQtyPad}
      index={index}
    />
  );

  if (!loading && products.length === 0 && !loadError) {
    return (
      <SafeAreaView
        edges={['top', 'left', 'right']}
        style={[styles.screen, { backgroundColor: colors.background }]}
      >
        <GreetingHeader shopName={shopName} />
        <EmptyState
          icon="storefront-outline"
          title="No products yet"
          subtitle="Add what you sell, then record sales in seconds."
          actionLabel="Add your first product"
          onAction={() => navigation.navigate('Stock')}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <GreetingHeader shopName={shopName} />
      <View style={styles.searchWrap}>
        <View style={[styles.searchPill, { backgroundColor: colors.raised }, elevation]}>
          <Ionicons name="search" size={18} color={colors.muted} />
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
        <EmptyState icon="alert-circle-outline" tone="danger" title="Something went wrong" subtitle={loadError} actionLabel="Try again" onAction={load} />
      ) : (
        <FlatList
          key={String(numColumns)} // numColumns can't change in place
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderProduct}
          numColumns={numColumns}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.gridContent}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.noResultsWrap}>
              <Text style={[styles.noResults, { color: colors.muted }]}>
                No products match “{search.trim()}”
              </Text>
              {/* New stock often arrives before it's entered — turn the dead
                  end into the fix. */}
              {search.trim().length > 0 && (
                <PressableScale
                  onPress={() => navigation.navigate('Stock', { prefillName: search.trim() })}
                  style={[styles.addFromSearchBtn, { backgroundColor: colors.primary }]}
                >
                  <Text style={[styles.addFromSearchText, { color: colors.onPrimary }]}>
                    Add “{search.trim()}” to Stock
                  </Text>
                </PressableScale>
              )}
            </View>
          }
        />
      )}

      {cartCount > 0 && (
        <Animated.View
          entering={reduceMotion ? undefined : FadeInUp.duration(220).easing(EASE)}
          exiting={reduceMotion ? undefined : FadeOutDown.duration(200).easing(EASE)}
          style={styles.cartBarWrap}
        >
          <PressableScale
            onPress={() => sheetRef.current?.snapToIndex(0)}
            scaleTo={0.98}
            style={[styles.cartBar, { backgroundColor: colors.primary }]}
          >
            <Text
              numberOfLines={1}
              style={[styles.cartBarCount, { color: colors.onPrimary }]}
            >
              {cartCount} {cartCount === 1 ? 'item' : 'items'} ▸
            </Text>
            {/* Dip the wrapper, not the Text: Animated.Text doesn't re-measure
                when the amount grows a digit, which clips the last character. */}
            <Animated.View style={[styles.totalWrap, totalDipStyle]}>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
                style={[styles.cartBarTotal, { color: colors.accent, fontSize: t.price }]}
              >
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
        onClose={() => setCheckoutStep('cart')}
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
          contentContainerStyle={[
            styles.sheetContent,
            { paddingBottom: insets.bottom + (checkoutStep === 'confirm' ? 210 : 120) },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.sheetTitle, { color: colors.text }]}>
            {checkoutStep === 'cart' ? 'Cart' : 'Confirm sale'}
          </Text>
          {checkoutStep === 'confirm' && (
            <View>
              <Text style={[styles.confirmItems, { color: colors.muted }]}>
                {cartCount} {cartCount === 1 ? 'item' : 'items'}
              </Text>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.5}
                style={[styles.confirmTotal, { color: colors.text, fontSize: t.hero }]}
              >
                {formatNaira(cartTotal)}
              </Text>
              {cartTotal > LARGE_SALE_THRESHOLD && (
                <View style={[styles.largeSaleBanner, { backgroundColor: colors.subtle, borderColor: colors.accent }]}>
                  <Ionicons name="warning" size={18} color={colors.accent} />
                  <Text style={[styles.largeSaleText, { color: colors.text }]}>
                    This is a large sale. Check the amount before recording.
                  </Text>
                </View>
              )}
              <PressableScale onPress={() => setCheckoutStep('cart')} hitSlop={8} style={styles.backToCart}>
                <Text style={[styles.backToCartText, { color: colors.primary }]}>‹ Back to cart</Text>
              </PressableScale>
            </View>
          )}
          {checkoutStep === 'cart' &&
          cartLines.map(({ product, qty }) => {
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
                  {/* Tap the price to haggle — adjusts this sale only. */}
                  <PressableScale
                    onPress={() => setPriceEditProduct(product)}
                    scaleTo={0.95}
                    hitSlop={6}
                    style={styles.priceTap}
                  >
                    <Text style={[styles.cartRowPrice, { color: priceOverrides[product.id] !== undefined ? colors.primary : colors.muted }]}>
                      {formatNaira(priceFor(product))} each
                      {priceOverrides[product.id] !== undefined ? `  (was ${formatNaira(product.price)})` : ''}
                    </Text>
                    {priceOverrides[product.id] === undefined && (
                      <Ionicons name="pencil" size={12} color={colors.muted} />
                    )}
                  </PressableScale>
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
                  {formatNaira(priceFor(product) * qty)}
                </Text>
                <PressableScale
                  onPress={() => removeLine(product)}
                  style={styles.removeBtn}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={22} color={colors.danger} />
                </PressableScale>
              </Animated.View>
            );
          })}
          {checkoutStep === 'cart' && (
            <View style={styles.sheetTotalRow}>
              <Text style={[styles.sheetTotalLabel, { color: colors.muted }]}>Total</Text>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
                style={[styles.sheetTotalValue, { color: colors.text, fontSize: t.hero }]}
              >
                {formatNaira(cartTotal)}
              </Text>
            </View>
          )}
        </BottomSheetScrollView>
      </BottomSheet>

      <QuantityPad
        visible={qtyPadProduct !== null}
        productName={qtyPadProduct?.name ?? ''}
        maxQty={qtyPadProduct ? qtyPadProduct.stock_qty - (cart[qtyPadProduct.id] || 0) : 0}
        onSubmit={(qty) => {
          if (qtyPadProduct) addToCart(qtyPadProduct, qty);
          setQtyPadProduct(null);
        }}
        onClose={() => setQtyPadProduct(null)}
      />

      <PriceEditor
        visible={priceEditProduct !== null}
        productName={priceEditProduct?.name ?? ''}
        listPrice={priceEditProduct?.price ?? 0}
        currentPrice={priceEditProduct ? priceFor(priceEditProduct) : 0}
        onSubmit={(price) => {
          if (priceEditProduct) {
            if (price === priceEditProduct.price) {
              const next = { ...priceOverrides };
              delete next[priceEditProduct.id];
              setPriceOverrides(next);
            } else {
              setPriceOverrides({ ...priceOverrides, [priceEditProduct.id]: price });
            }
          }
          setPriceEditProduct(null);
        }}
        onClose={() => setPriceEditProduct(null)}
      />

      <CreditCustomerPrompt
        visible={creditPromptVisible}
        suggestions={creditSuggestions}
        onSubmit={(name) => {
          setCreditPromptVisible(false);
          doRecord(true, name);
        }}
        onClose={() => setCreditPromptVisible(false)}
      />

      {toast && (
        <Toast
          message={toast.message}
          actionLabel={toast.actionLabel}
          onAction={toast.onAction}
          onHide={() => setToast(null)}
        />
      )}
      {success && (
        <SuccessOverlay
          message={success}
          onDone={() => {
            setSuccess(null);
            setReceiptText(null);
          }}
          actionLabel={receiptText ? 'Send receipt' : undefined}
          onAction={
            receiptText
              ? () => {
                  Share.share({ message: receiptText }).catch(() => {});
                }
              : undefined
          }
        />
      )}
    </SafeAreaView>
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
    minHeight: touch.minTarget, // grows with content, never fixed
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
  noResultsWrap: {
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  noResults: {
    textAlign: 'center',
    fontSize: type.body,
  },
  addFromSearchBtn: {
    minHeight: touch.minTarget,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addFromSearchText: {
    fontSize: type.body,
    fontWeight: '700',
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
    elevation: 6,
  },
  cartBarCount: {
    flex: 1, // count takes leftover space; the amount is never squeezed off
    fontSize: type.body,
    fontWeight: '700',
  },
  totalWrap: {
    flexShrink: 1, // may shrink — adjustsFontSizeToFit scales the text down instead of clipping
    marginLeft: spacing.sm,
  },
  cartBarTotal: {
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
  priceTap: {
    minHeight: 32, // comfortably tappable without inflating the row
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
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
  sheetTotalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  sheetTotalLabel: {
    fontSize: type.body,
    fontWeight: '600',
  },
  sheetTotalValue: {
    flexShrink: 1,
    fontWeight: '800',
  },
  footerWrap: {
    paddingHorizontal: spacing.lg,
  },
  completeBtn: {
    height: touch.button,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeBtnText: {
    fontSize: 20,
    fontWeight: '800',
  },
  creditBtn: {
    minHeight: touch.minTarget,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  creditBtnText: {
    fontSize: type.body,
    fontWeight: '700',
  },
  confirmItems: {
    fontSize: type.body,
  },
  confirmTotal: {
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  largeSaleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginTop: spacing.lg,
  },
  largeSaleText: {
    flex: 1,
    fontSize: type.label,
    lineHeight: 18,
  },
  backToCart: {
    minHeight: 44,
    justifyContent: 'center',
    marginTop: spacing.md,
    alignSelf: 'flex-start',
  },
  backToCartText: {
    fontSize: type.body,
    fontWeight: '700',
  },
});
