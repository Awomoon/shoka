// Backup file plumbing: write + share on export, pick + read + validate on
// restore. All database work stays in database.ts.
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { exportAllData, validateBackup, setSetting } from '../db/database';
import type { BackupFile } from '../db/database';

function backupFilename(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `shoptally-backup-${y}-${m}-${d}.json`;
}

// Serializes every table to JSON, writes it to the cache directory and opens
// the native share sheet. Records the backup time only after the share sheet
// actually opened.
export async function exportBackup(): Promise<void> {
  const backup = await exportAllData();
  const file = new File(Paths.cache, backupFilename());
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(backup, null, 2));

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Save your ShopTally backup',
  });
  await setSetting('lastBackupAt', new Date().toISOString());
}

export type PickBackupResult =
  | { status: 'cancelled' }
  | { status: 'invalid'; error: string }
  | { status: 'ok'; backup: BackupFile };

// Picks a backup file and fully validates it. Never touches the database.
export async function pickAndValidateBackup(): Promise<PickBackupResult> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (picked.canceled || picked.assets.length === 0) return { status: 'cancelled' };

  let text: string;
  try {
    text = await new File(picked.assets[0].uri).text();
  } catch (e) {
    return { status: 'invalid', error: "Couldn't read the selected file." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { status: 'invalid', error: 'This file is not a valid backup (not readable JSON).' };
  }

  const result = validateBackup(parsed);
  if (!result.ok) return { status: 'invalid', error: result.error };
  return { status: 'ok', backup: result.backup };
}
