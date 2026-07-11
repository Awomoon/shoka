import React, { useState } from 'react';
import { View, Text, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { resetDatabase, restoreAllData, getDb } from '../db/database';
import { pickAndValidateBackup } from '../utils/backup';
import { formatDateTime } from '../utils/format';
import { useTheme } from '../theme/ThemeContext';
import { spacing, type, touch, radius } from '../theme';
import PressableScale from '../components/PressableScale';

interface RecoveryScreenProps {
  onRetry: () => void;
  onRecovered: () => void;
}

// Shown instead of a white screen when the database fails to open.
// Restore picks and VALIDATES a backup before the broken database file is
// replaced, so cancelling or a bad file never makes things worse.
export default function RecoveryScreen({ onRetry, onRecovered }: RecoveryScreenProps) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);

  const restoreFromBackup = async () => {
    setBusy(true);
    try {
      const picked = await pickAndValidateBackup();
      if (picked.status === 'cancelled') return;
      if (picked.status === 'invalid') {
        Alert.alert('Cannot restore', picked.error);
        return;
      }
      const { backup } = picked;
      Alert.alert(
        'Restore this backup?',
        `Backup from ${formatDateTime(backup.exportedAt)} — ${backup.products.length} products, ${backup.sales.length} sales.\n\nThe damaged data on this phone will be replaced.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore',
            onPress: async () => {
              try {
                await resetDatabase();
                await getDb(); // recreate a clean schema
                await restoreAllData(backup);
                onRecovered();
              } catch (e) {
                Alert.alert('Restore failed', 'The backup could not be restored. Please try again.');
              }
            },
          },
        ]
      );
    } catch (e) {
      Alert.alert('Cannot restore', 'The file could not be opened. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.body}>
        <Text style={styles.emoji}>🛠️</Text>
        <Text style={[styles.title, { color: colors.text }]}>Your records couldn't be opened</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          Something is wrong with the data stored on this phone. Try again, or restore from a
          backup file you exported earlier.
        </Text>

        <PressableScale onPress={onRetry} style={[styles.btn, { backgroundColor: colors.primary }]}>
          <Text style={[styles.btnText, { color: colors.onPrimary }]}>Try again</Text>
        </PressableScale>
        <PressableScale
          disabled={busy}
          onPress={restoreFromBackup}
          style={[styles.btn, styles.outlineBtn, { borderColor: colors.border, marginTop: spacing.sm }]}
        >
          {busy ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={[styles.btnText, { color: colors.text }]}>Restore from backup</Text>
          )}
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
  btn: {
    height: touch.button,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
  },
  btnText: {
    fontSize: type.body,
    fontWeight: '800',
  },
});
