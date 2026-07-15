import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Modal,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { spacing, type, touch, radius } from '../theme';
import { formatNaira, parseIntSafe } from '../utils/format';
import PressableScale from './PressableScale';

// Small centered dialogs for the Sell flow. Native RN Modal — no portals to
// lose behind screen containers, and the keyboard behaves.
function DialogShell({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]} onPress={onClose} />
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// Long-press quantity entry: type a number or tap a quick amount.
export function QuantityPad({
  productName,
  maxQty,
  visible,
  onSubmit,
  onClose,
}: {
  productName: string;
  maxQty: number;
  visible: boolean;
  onSubmit: (qty: number) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setText('');
      setError(null);
    }
  }, [visible]);

  const submit = (raw?: number) => {
    const qty = raw ?? parseIntSafe(text);
    if (qty === null || qty <= 0) {
      setError('Enter how many.');
      return;
    }
    if (qty > maxQty) {
      setError(`Only ${maxQty} available.`);
      return;
    }
    onSubmit(qty);
  };

  return (
    <DialogShell visible={visible} title={`How many ${productName}?`} onClose={onClose}>
      <TextInput
        value={text}
        onChangeText={(t) => {
          setText(t);
          setError(null);
        }}
        placeholder={`Up to ${maxQty}`}
        placeholderTextColor={colors.muted}
        keyboardType="numeric"
        autoFocus
        onSubmitEditing={() => submit()}
        style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
      />
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
      <View style={styles.quickRow}>
        {[5, 10, 20].map((n) => (
          <PressableScale
            key={n}
            onPress={() => submit(n)}
            style={[styles.quickBtn, { backgroundColor: colors.subtle }]}
          >
            <Text style={[styles.quickText, { color: colors.text }]}>{n}</Text>
          </PressableScale>
        ))}
      </View>
      <PressableScale onPress={() => submit()} style={[styles.mainBtn, { backgroundColor: colors.primary }]}>
        <Text style={[styles.mainBtnText, { color: colors.onPrimary }]}>Add to cart</Text>
      </PressableScale>
    </DialogShell>
  );
}

// Per-sale price editor: adjusts what THIS sale charges; the product's
// stored price is never touched from here.
export function PriceEditor({
  productName,
  listPrice,
  currentPrice,
  visible,
  onSubmit,
  onClose,
}: {
  productName: string;
  listPrice: number;
  currentPrice: number;
  visible: boolean;
  onSubmit: (price: number) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setText(String(currentPrice));
      setError(null);
    }
  }, [visible, currentPrice]);

  const submit = () => {
    const price = parseIntSafe(text);
    // parseIntSafe strips signs, so price is never below zero by construction.
    if (price === null) {
      setError('Enter the price for this sale.');
      return;
    }
    if (price < listPrice * 0.5) {
      Alert.alert(
        'Big discount',
        `${formatNaira(price)} is less than half the usual ${formatNaira(listPrice)}. Charge it anyway?`,
        [
          { text: 'Let me fix it', style: 'cancel' },
          { text: 'Yes, charge it', onPress: () => onSubmit(price) },
        ]
      );
      return;
    }
    onSubmit(price);
  };

  return (
    <DialogShell visible={visible} title={`Price for ${productName}`} onClose={onClose}>
      <Text style={[styles.hint, { color: colors.muted }]}>
        Usual price {formatNaira(listPrice)} · this sale only
      </Text>
      <TextInput
        value={text}
        onChangeText={(t) => {
          setText(t);
          setError(null);
        }}
        keyboardType="numeric"
        autoFocus
        selectTextOnFocus
        onSubmitEditing={submit}
        style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
      />
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
      <PressableScale onPress={submit} style={[styles.mainBtn, { backgroundColor: colors.primary }]}>
        <Text style={[styles.mainBtnText, { color: colors.onPrimary }]}>Use this price</Text>
      </PressableScale>
    </DialogShell>
  );
}

// Credit checkout: who owes? Suggests names used before.
export function CreditCustomerPrompt({
  suggestions,
  visible,
  onSubmit,
  onClose,
}: {
  suggestions: string[];
  visible: boolean;
  onSubmit: (name: string) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setName('');
      setError(null);
    }
  }, [visible]);

  const submit = (chosen?: string) => {
    const value = (chosen ?? name).trim();
    if (!value) {
      setError('A credit sale needs a name.');
      return;
    }
    onSubmit(value);
  };

  return (
    <DialogShell visible={visible} title="Who is taking this on credit?" onClose={onClose}>
      <TextInput
        value={name}
        onChangeText={(t) => {
          setName(t);
          setError(null);
        }}
        placeholder="Customer name"
        placeholderTextColor={colors.muted}
        autoFocus
        onSubmitEditing={() => submit()}
        style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
      />
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
      {suggestions.length > 0 && (
        <View style={styles.chipWrap}>
          {suggestions.map((s) => (
            <PressableScale
              key={s}
              onPress={() => submit(s)}
              style={[styles.chip, { backgroundColor: colors.subtle }]}
            >
              <Text numberOfLines={1} style={[styles.chipText, { color: colors.text }]}>{s}</Text>
            </PressableScale>
          ))}
        </View>
      )}
      <PressableScale onPress={() => submit()} style={[styles.mainBtn, { backgroundColor: colors.primary }]}>
        <Text style={[styles.mainBtnText, { color: colors.onPrimary }]}>Record credit sale</Text>
      </PressableScale>
    </DialogShell>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  title: {
    fontSize: type.title,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
  hint: {
    fontSize: type.label,
    marginBottom: spacing.sm,
  },
  input: {
    height: touch.minTarget,
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: spacing.lg,
    fontSize: type.title,
  },
  error: {
    fontSize: type.label,
    marginTop: spacing.xs,
  },
  quickRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  quickBtn: {
    flex: 1,
    minHeight: touch.minTarget,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickText: {
    fontSize: type.title,
    fontWeight: '800',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  chip: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    minHeight: 40,
    justifyContent: 'center',
    maxWidth: '100%',
  },
  chipText: {
    fontSize: type.body,
    fontWeight: '600',
  },
  mainBtn: {
    minHeight: touch.minTarget,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  mainBtnText: {
    fontSize: type.body,
    fontWeight: '800',
  },
});
