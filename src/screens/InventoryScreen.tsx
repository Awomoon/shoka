import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Alert,
  StyleSheet,
} from 'react-native';
import type { KeyboardTypeOptions, ListRenderItem } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetBackdrop,
  BottomSheetTextInput,
  useBottomSheetTimingConfigs,
} from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import Animated, {
  FadeIn,
  LinearTransition,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  useReducedMotion,
  ReduceMotion,
} from 'react-native-reanimated';
import {
  listProducts,
  addProduct,
  updateProduct,
  deactivateProduct,
  adjustStock,
} from '../db/database';
import type { Product } from '../db/database';
import { useTheme } from '../theme/ThemeContext';
import { spacing, type, touch, radius } from '../theme';
import { formatNaira, parseIntSafe } from '../utils/format';
import PressableScale from '../components/PressableScale';
import Toast from '../components/Toast';
import EmptyState from '../components/EmptyState';
import ScreenHeader from '../components/ScreenHeader';

const STAGGER_CAP = 8;
const EASE = Easing.out(Easing.cubic);

interface AddForm {
  name: string;
  price: string;
  stock: string;
  threshold: string;
}

interface EditForm {
  name: string;
  price: string;
  threshold: string;
  restock: string;
}

type AddErrors = Partial<Record<keyof AddForm, string>>;
type EditErrors = Partial<Record<keyof EditForm, string>>;

// Left edge of each product card: green = healthy, yellow = at the
// threshold, red = below it. Cross-fades when a sale moves it.
function StockStrip({ stock, threshold }: { stock: number; threshold: number }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const color =
    stock > threshold ? colors.primary : stock === threshold ? colors.accent : colors.danger;
  const strip = useSharedValue(color);
  React.useEffect(() => {
    strip.value = reduceMotion ? color : withTiming(color, { duration: 250 });
  }, [color, reduceMotion, strip]);
  const style = useAnimatedStyle(() => ({ backgroundColor: strip.value }));
  return <Animated.View style={[styles.strip, style]} />;
}

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  autoFocus?: boolean;
  error?: string;
}

function Field({ label, value, onChangeText, placeholder, keyboardType, autoFocus, error }: FieldProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.muted }]}>{label}</Text>
      <BottomSheetTextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={keyboardType}
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          styles.fieldInput,
          {
            backgroundColor: colors.background,
            color: colors.text,
            borderColor: error ? colors.danger : focused ? colors.primary : colors.border,
          },
        ]}
      />
      {error ? <Text style={[styles.fieldError, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

interface FormSheetProps {
  title: string;
  onDismiss?: () => void;
  children: React.ReactNode;
}

// Form sheet shared by Add and Edit. Content scrolls; keyboard pushes the
// sheet up instead of covering the focused field. In-screen BottomSheet, not
// BottomSheetModal — the modal's portal can render behind the native screen
// containers on the new architecture and never become visible.
const FormSheet = React.forwardRef<BottomSheet, FormSheetProps>(function FormSheet(
  { title, onDismiss, children },
  ref
) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  // Smooth timing sheet — same cubic ease as everything else, no spring.
  const sheetAnimation = useBottomSheetTimingConfigs({ duration: 250, easing: EASE });
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
  return (
    <BottomSheet
      ref={ref}
      index={-1}
      snapPoints={['75%', '90%']}
      enableDynamicSizing={false}
      enablePanDownToClose
      animationConfigs={sheetAnimation}
      // Sheets must open even when the phone has system animations off
      // (reduced motion) — otherwise they stay stuck off-screen.
      overrideReduceMotion={ReduceMotion.Never}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      onClose={onDismiss}
      backdropComponent={renderBackdrop}
      backgroundStyle={[styles.sheetBg, { backgroundColor: colors.card }]}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
    >
      <BottomSheetScrollView
        contentContainerStyle={[styles.sheetContent, { paddingBottom: insets.bottom + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.sheetTitle, { color: colors.text }]}>{title}</Text>
        {children}
      </BottomSheetScrollView>
    </BottomSheet>
  );
});

export default function InventoryScreen() {
  const { colors, elevation } = useTheme();
  const reduceMotion = useReducedMotion();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  // Add form
  const [addForm, setAddForm] = useState<AddForm>({ name: '', price: '', stock: '', threshold: '' });
  const [addErrors, setAddErrors] = useState<AddErrors>({});
  const addRef = useRef<BottomSheet>(null);

  // Edit sheet
  const [editing, setEditing] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ name: '', price: '', threshold: '', restock: '' });
  const [editErrors, setEditErrors] = useState<EditErrors>({});
  const editRef = useRef<BottomSheet>(null);

  const load = useCallback(async () => {
    try {
      setProducts(await listProducts());
    } catch (e) {
      setToast("Couldn't load products");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Low-stock products sort to the top.
  const isLow = (p: Product) => p.stock_qty <= p.low_stock_threshold;
  const sorted = useMemo(() => {
    return [...products].sort((a, b) => {
      if (isLow(a) !== isLow(b)) return isLow(a) ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [products]);
  const lowCount = useMemo(() => products.filter(isLow).length, [products]);

  const openAdd = () => {
    setAddForm({ name: '', price: '', stock: '', threshold: '' });
    setAddErrors({});
    addRef.current?.snapToIndex(0);
  };

  const saveAdd = async () => {
    const errors: AddErrors = {};
    const name = addForm.name.trim();
    const price = parseIntSafe(addForm.price);
    const stock = addForm.stock.trim() === '' ? 0 : parseIntSafe(addForm.stock);
    const threshold = addForm.threshold.trim() === '' ? 5 : parseIntSafe(addForm.threshold);
    if (!name) errors.name = 'Give the product a name.';
    if (price === null || price <= 0) errors.price = 'Price must be more than ₦0.';
    if (stock === null || stock < 0) errors.stock = 'Stock must be 0 or more.';
    if (threshold === null || threshold < 0) errors.threshold = 'Must be 0 or more.';
    setAddErrors(errors);
    if (Object.keys(errors).length > 0 || price === null || stock === null || threshold === null) return;
    try {
      await addProduct(name, price, stock, threshold);
      addRef.current?.close();
      setToast(`${name} added`);
      load();
    } catch (e) {
      Alert.alert('Not saved', 'The product could not be saved. Please try again.');
    }
  };

  const openEdit = (product: Product) => {
    setEditForm({
      name: product.name,
      price: String(product.price),
      threshold: String(product.low_stock_threshold),
      restock: '',
    });
    setEditErrors({});
    setEditing(product);
    editRef.current?.snapToIndex(0);
  };

  const saveEdit = async () => {
    if (!editing) return;
    const errors: EditErrors = {};
    const name = editForm.name.trim();
    const price = parseIntSafe(editForm.price);
    const threshold = editForm.threshold.trim() === '' ? 5 : parseIntSafe(editForm.threshold);
    if (!name) errors.name = 'Give the product a name.';
    if (price === null || price <= 0) errors.price = 'Price must be more than ₦0.';
    if (threshold === null || threshold < 0) errors.threshold = 'Must be 0 or more.';
    setEditErrors(errors);
    if (Object.keys(errors).length > 0 || price === null || threshold === null) return;
    try {
      await updateProduct(editing.id, { name, price, lowStockThreshold: threshold });
      editRef.current?.close();
      setToast('Saved');
      load();
    } catch (e) {
      Alert.alert('Not saved', 'The changes could not be saved. Please try again.');
    }
  };

  const doRestock = async () => {
    if (!editing) return;
    const qty = parseIntSafe(editForm.restock);
    if (qty === null || qty <= 0) {
      setEditErrors({ ...editErrors, restock: 'Enter how many you are adding.' });
      return;
    }
    try {
      await adjustStock(editing.id, qty);
      editRef.current?.close();
      setToast(`+${qty} added to ${editing.name}`);
      load();
    } catch (e) {
      Alert.alert('Not saved', 'The restock could not be saved. Please try again.');
    }
  };

  const confirmRemove = () => {
    if (!editing) return;
    const target = editing;
    Alert.alert(
      'Remove product?',
      `${target.name} will no longer show on the Sell screen. Past sales keep it.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deactivateProduct(target.id);
              editRef.current?.close();
              setToast('Product removed');
              load();
            } catch (e) {
              Alert.alert('Not removed', 'The product could not be removed. Please try again.');
            }
          },
        },
      ]
    );
  };

  const renderProduct: ListRenderItem<Product> = ({ item, index }) => (
    <Animated.View
      entering={
        reduceMotion
          ? undefined
          : FadeIn.delay(Math.min(index, STAGGER_CAP) * 40).duration(180)
      }
      layout={reduceMotion ? undefined : LinearTransition.duration(200)}
    >
      <PressableScale
        onPress={() => openEdit(item)}
        style={[styles.row, { backgroundColor: colors.raised }, elevation]}
      >
        <StockStrip stock={item.stock_qty} threshold={item.low_stock_threshold} />
        <View style={styles.rowInfo}>
          <Text numberOfLines={1} style={[styles.rowName, { color: colors.text }]}>
            {item.name}
          </Text>
          <Text style={[styles.rowPrice, { color: colors.muted }]}>
            {formatNaira(item.price)}
          </Text>
        </View>
        <View style={[styles.stockBadge, { backgroundColor: colors.subtle }]}>
          <Text style={[styles.stockBadgeText, { color: colors.text }]}>{item.stock_qty}</Text>
        </View>
      </PressableScale>
    </Animated.View>
  );

  const addAction = (
    <PressableScale onPress={openAdd} style={[styles.addBtn, { backgroundColor: colors.primary }]}>
      <Text style={[styles.addBtnText, { color: colors.onPrimary }]}>＋ Add</Text>
    </PressableScale>
  );

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <ScreenHeader title="Stock" action={addAction} />

      {!loading && products.length === 0 ? (
        <EmptyState
          emoji="📦"
          title="No products yet"
          subtitle="Add what you sell — name, price and how many you have."
          actionLabel="Add your first product"
          onAction={openAdd}
        />
      ) : (
        <>
          <View style={styles.summaryWrap}>
            <Text style={[styles.summaryText, { color: colors.muted }]}>
              {products.length} {products.length === 1 ? 'product' : 'products'}
              {' · '}
              <Text style={{ color: lowCount > 0 ? colors.danger : colors.muted }}>
                {lowCount} low on stock
              </Text>
            </Text>
          </View>
          <FlatList
            data={sorted}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderProduct}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
          />
        </>
      )}

      <FormSheet ref={addRef} title="Add product">
        <Field
          label="NAME"
          value={addForm.name}
          onChangeText={(t) => setAddForm({ ...addForm, name: t })}
          placeholder="e.g. Coke 50cl"
          error={addErrors.name}
        />
        <Field
          label="PRICE (₦)"
          value={addForm.price}
          onChangeText={(t) => setAddForm({ ...addForm, price: t })}
          placeholder="e.g. 500"
          keyboardType="numeric"
          error={addErrors.price}
        />
        <Field
          label="STARTING STOCK"
          value={addForm.stock}
          onChangeText={(t) => setAddForm({ ...addForm, stock: t })}
          placeholder="0"
          keyboardType="numeric"
          error={addErrors.stock}
        />
        <Field
          label="LOW-STOCK ALERT AT"
          value={addForm.threshold}
          onChangeText={(t) => setAddForm({ ...addForm, threshold: t })}
          placeholder="5"
          keyboardType="numeric"
          error={addErrors.threshold}
        />
        <PressableScale onPress={saveAdd} style={[styles.saveBtn, { backgroundColor: colors.primary }]}>
          <Text style={[styles.saveBtnText, { color: colors.onPrimary }]}>Save product</Text>
        </PressableScale>
      </FormSheet>

      <FormSheet
        ref={editRef}
        title={editing ? `Edit ${editing.name}` : 'Edit'}
        onDismiss={() => setEditing(null)}
      >
        {editing && (
          <>
            <Field
              label="NAME"
              value={editForm.name}
              onChangeText={(t) => setEditForm({ ...editForm, name: t })}
              error={editErrors.name}
            />
            <Field
              label="PRICE (₦)"
              value={editForm.price}
              onChangeText={(t) => setEditForm({ ...editForm, price: t })}
              keyboardType="numeric"
              error={editErrors.price}
            />
            <Field
              label="LOW-STOCK ALERT AT"
              value={editForm.threshold}
              onChangeText={(t) => setEditForm({ ...editForm, threshold: t })}
              keyboardType="numeric"
              error={editErrors.threshold}
            />
            <PressableScale onPress={saveEdit} style={[styles.saveBtn, { backgroundColor: colors.primary }]}>
              <Text style={[styles.saveBtnText, { color: colors.onPrimary }]}>Save changes</Text>
            </PressableScale>

            <View style={[styles.restockBox, { borderColor: colors.border }]}>
              <Text style={[styles.restockTitle, { color: colors.text }]}>
                Restock — {editing.stock_qty} in stock now
              </Text>
              <Field
                label="HOW MANY ARE YOU ADDING?"
                value={editForm.restock}
                onChangeText={(t) => setEditForm({ ...editForm, restock: t })}
                placeholder="e.g. 24"
                keyboardType="numeric"
                error={editErrors.restock}
              />
              <PressableScale
                onPress={doRestock}
                style={[styles.saveBtn, { backgroundColor: colors.accent }]}
              >
                <Text style={[styles.saveBtnText, { color: colors.onAccent }]}>Add to stock</Text>
              </PressableScale>
            </View>

            <PressableScale onPress={confirmRemove} style={styles.removeBtn}>
              <Text style={[styles.removeBtnText, { color: colors.danger }]}>Remove product</Text>
            </PressableScale>
          </>
        )}
      </FormSheet>

      {toast && <Toast message={toast} onHide={() => setToast(null)} bottom={24} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  addBtn: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    fontSize: type.body,
    fontWeight: '800',
  },
  summaryWrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  summaryText: {
    fontSize: type.label,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  listContent: {
    padding: spacing.lg,
    paddingTop: spacing.xs,
    gap: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  row: {
    minHeight: touch.minTarget + 8,
    borderRadius: radius.md,
    paddingRight: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  strip: {
    alignSelf: 'stretch',
    width: 6,
    borderRadius: radius.pill,
    marginLeft: spacing.sm,
    marginRight: spacing.md,
  },
  rowInfo: {
    flex: 1,
  },
  rowName: {
    fontSize: type.body,
    fontWeight: '700',
  },
  rowPrice: {
    fontSize: type.body,
    marginTop: 2,
  },
  stockBadge: {
    minWidth: 48,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  stockBadgeText: {
    fontSize: type.body,
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
    marginBottom: spacing.md,
  },
  field: {
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    fontSize: type.label,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  fieldInput: {
    height: touch.minTarget,
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: spacing.lg,
    fontSize: type.title,
  },
  fieldError: {
    fontSize: type.label,
    marginTop: spacing.xs,
  },
  saveBtn: {
    minHeight: touch.minTarget,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  saveBtnText: {
    fontSize: type.body,
    fontWeight: '800',
  },
  restockBox: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  restockTitle: {
    fontSize: type.body,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  removeBtn: {
    minHeight: touch.minTarget,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  removeBtnText: {
    fontSize: type.body,
    fontWeight: '700',
  },
});
