import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { setSetting } from '../db/database';
import { useTheme } from '../theme/ThemeContext';
import { spacing, type, touch, radius } from '../theme';
import PressableScale from '../components/PressableScale';

// One screen, first launch only: ask for the shop name, allow skipping.
// Either way the owner lands on the Sell screen ready to add products.
export default function WelcomeScreen({ onDone }: { onDone: () => void }) {
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [focused, setFocused] = useState(false);
  const [saving, setSaving] = useState(false);

  const finish = async (save: boolean) => {
    if (saving) return;
    setSaving(true);
    try {
      if (save && name.trim()) await setSetting('shopName', name.trim());
      await setSetting('welcomeDone', '1');
    } catch (e) {
      // Even if saving fails, never trap the owner on the welcome screen —
      // the name can be set again in Settings.
    } finally {
      onDone();
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.body}>
        <Text style={styles.emoji}>🏪</Text>
        <Text style={[styles.title, { color: colors.text }]}>Welcome to Shoka</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          Sell fast, know your stock, see your money — all offline.
        </Text>

        <Text style={[styles.fieldLabel, { color: colors.muted }]}>WHAT'S YOUR SHOP CALLED?</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. DebbyRR Stores"
          placeholderTextColor={colors.muted}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          returnKeyType="done"
          onSubmitEditing={() => finish(true)}
          style={[
            styles.input,
            {
              backgroundColor: colors.card,
              color: colors.text,
              borderColor: focused ? colors.primary : colors.border,
            },
          ]}
        />

        <PressableScale
          onPress={() => finish(true)}
          style={[styles.startBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.startBtnText, { color: colors.onPrimary }]}>Start selling</Text>
        </PressableScale>
        <PressableScale onPress={() => finish(false)} style={styles.skipBtn}>
          <Text style={[styles.skipText, { color: colors.muted }]}>Skip for now</Text>
        </PressableScale>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emoji: {
    fontSize: 56,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: type.screenTitle,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: type.body,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  fieldLabel: {
    fontSize: type.label,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  input: {
    height: touch.minTarget,
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: spacing.lg,
    fontSize: type.body,
  },
  startBtn: {
    height: touch.button,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  startBtnText: {
    fontSize: type.body,
    fontWeight: '800',
  },
  skipBtn: {
    minHeight: touch.minTarget,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  skipText: {
    fontSize: type.body,
    fontWeight: '600',
  },
});
