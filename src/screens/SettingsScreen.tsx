import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Constants from 'expo-constants';
import { getSetting, setSetting, restoreAllData } from '../db/database';
import { exportBackup, pickAndValidateBackup } from '../utils/backup';
import { formatDateTime } from '../utils/format';
import { useTheme } from '../theme/ThemeContext';
import { spacing, type, touch, radius } from '../theme';
import PressableScale from '../components/PressableScale';
import Toast from '../components/Toast';
import ScreenHeader from '../components/ScreenHeader';
import ThemeToggle from '../components/ThemeToggle';
import type { RootStackParamList } from '../navigation/types';

type SettingsScreenProps = NativeStackScreenProps<RootStackParamList, 'Settings'>;

function SectionCard({ label, children }: { label: string; children: React.ReactNode }) {
  const { colors, elevation } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.raised }, elevation]}>
      <Text style={[styles.sectionLabel, { color: colors.muted }]}>{label}</Text>
      {children}
    </View>
  );
}

// The tally mark from the app icon, drawn with theme tokens.
function LogoMark() {
  const { colors } = useTheme();
  return (
    <View style={styles.logoRow}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={[styles.logoBar, { backgroundColor: colors.primary }]} />
      ))}
      <View style={[styles.logoStrike, { backgroundColor: colors.accent }]} />
    </View>
  );
}

export default function SettingsScreen({ navigation }: SettingsScreenProps) {
  const { colors } = useTheme();

  const [shopName, setShopName] = useState('');
  const [nameFocused, setNameFocused] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [busy, setBusy] = useState<'export' | 'restore' | null>(null);

  const loadSettings = useCallback(() => {
    getSetting('shopName')
      .then((saved) => {
        if (saved) setShopName(saved);
      })
      .catch(() => {});
    getSetting('lastBackupAt')
      .then(setLastBackupAt)
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const doExport = async () => {
    setBusy('export');
    try {
      await exportBackup();
      const now = new Date().toISOString();
      setLastBackupAt(now);
      setToast('Backup ready to share');
    } catch (e) {
      Alert.alert(
        'Backup failed',
        e instanceof Error && e.message ? e.message : 'The backup could not be created. Please try again.'
      );
    } finally {
      setBusy(null);
    }
  };

  const doRestore = async () => {
    setBusy('restore');
    try {
      const picked = await pickAndValidateBackup();
      if (picked.status === 'cancelled') return;
      if (picked.status === 'invalid') {
        Alert.alert('Cannot restore', `${picked.error} Your current data has not been changed.`);
        return;
      }
      const { backup } = picked;
      Alert.alert(
        'Restore this backup?',
        `Backup from ${formatDateTime(backup.exportedAt)} — ${backup.products.length} products, ${backup.sales.length} sales.\n\nALL current data will be replaced. This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Replace my data',
            style: 'destructive',
            onPress: async () => {
              try {
                await restoreAllData(backup);
                setShopName('');
                loadSettings();
                setToast('Backup restored');
              } catch (err) {
                Alert.alert(
                  'Restore failed',
                  'Nothing was changed — your current data is intact. Please try again with another file.'
                );
              }
            },
          },
        ]
      );
    } catch (e) {
      Alert.alert('Cannot restore', 'The file could not be opened. Your current data has not been changed.');
    } finally {
      setBusy(null);
    }
  };

  const saveShopName = useCallback(async () => {
    try {
      await setSetting('shopName', shopName.trim());
      setToast(shopName.trim() ? 'Shop name saved' : 'Shop name cleared');
    } catch (e) {
      setToast("Couldn't save the shop name");
    }
  }, [shopName]);

  const version = Constants.expoConfig?.version ?? '—';

  const doneAction = (
    <PressableScale onPress={() => navigation.goBack()} style={styles.doneBtn} hitSlop={8}>
      <Text style={[styles.doneText, { color: colors.primary }]}>Done</Text>
    </PressableScale>
  );

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <ScreenHeader title="Settings" action={doneAction} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <SectionCard label="SHOP PROFILE">
          <Text style={[styles.fieldLabel, { color: colors.muted }]}>SHOP NAME</Text>
          <TextInput
            value={shopName}
            onChangeText={setShopName}
            placeholder="e.g. Mama Nkechi Stores"
            placeholderTextColor={colors.muted}
            onFocus={() => setNameFocused(true)}
            onBlur={() => setNameFocused(false)}
            returnKeyType="done"
            onSubmitEditing={saveShopName}
            style={[
              styles.input,
              {
                backgroundColor: colors.background,
                color: colors.text,
                borderColor: nameFocused ? colors.primary : colors.border,
              },
            ]}
          />
          <Text style={[styles.hint, { color: colors.muted }]}>
            Shown on the Sell screen and on shared summaries.
          </Text>
          <PressableScale
            onPress={saveShopName}
            style={[styles.saveBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.saveBtnText, { color: colors.onPrimary }]}>Save</Text>
          </PressableScale>
        </SectionCard>

        <SectionCard label="BACKUP & RESTORE">
          <Text style={[styles.aboutLine, { color: colors.muted, marginTop: 0, marginBottom: spacing.md }]}>
            Last backup: {lastBackupAt ? formatDateTime(lastBackupAt) : 'never — your records live only on this phone'}
          </Text>
          <PressableScale
            disabled={busy !== null}
            onPress={doExport}
            style={[styles.saveBtn, { backgroundColor: colors.primary }]}
          >
            {busy === 'export' ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={[styles.saveBtnText, { color: colors.onPrimary }]}>Export backup</Text>
            )}
          </PressableScale>
          <PressableScale
            disabled={busy !== null}
            onPress={doRestore}
            style={[styles.saveBtn, styles.outlineBtn, { borderColor: colors.border, marginTop: spacing.sm }]}
          >
            {busy === 'restore' ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={[styles.saveBtnText, { color: colors.text }]}>Restore from backup</Text>
            )}
          </PressableScale>
          <Text style={[styles.hint, { color: colors.muted, marginBottom: 0 }]}>
            Send the backup file to your own WhatsApp or email. Restoring replaces everything with the backup's contents.
          </Text>
        </SectionCard>

        <SectionCard label="APPEARANCE">
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>Theme</Text>
            <ThemeToggle />
          </View>
        </SectionCard>

        <SectionCard label="ABOUT">
          <LogoMark />
          <Text style={[styles.appName, { color: colors.text }]}>ShopTally</Text>
          <Text style={[styles.aboutLine, { color: colors.muted }]}>Version {version}</Text>
          <Text style={[styles.aboutLine, { color: colors.muted }]}>
            Built by Moontech · WhatsApp +234 706 836 7213
          </Text>
        </SectionCard>
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
  sectionLabel: {
    fontSize: type.label,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  doneBtn: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  doneText: {
    fontSize: type.body,
    fontWeight: '700',
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
  hint: {
    fontSize: type.label,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  saveBtn: {
    minHeight: touch.minTarget,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: type.body,
    fontWeight: '800',
  },
  outlineBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  rowLabel: {
    fontSize: type.body,
    fontWeight: '600',
  },
  logoRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    marginBottom: spacing.sm,
    width: 62,
  },
  logoBar: {
    width: 8,
    height: 40,
    borderRadius: radius.pill,
  },
  logoStrike: {
    position: 'absolute',
    left: -4,
    top: 16,
    width: 62,
    height: 8,
    borderRadius: radius.pill,
    transform: [{ rotate: '-20deg' }],
  },
  appName: {
    fontSize: type.title,
    fontWeight: '800',
  },
  aboutLine: {
    fontSize: type.body,
    marginTop: spacing.xs,
  },
});
