// Backup file format and validation. Pure module — no native imports — so it
// can be exercised outside the app (and stays testable in plain Node).
import type { Product, Sale, SaleItem, SettingRow } from './database';

export const BACKUP_SCHEMA_VERSION = 1;

// 'shoptally' is the app's pre-rename id: backups exported before the Shoka
// rename carry it, and they must keep restoring forever. This constant is a
// deliberate, permanent exception to the rename.
const BACKUP_APP_IDS = ['shoka', 'shoptally'];

export interface BackupFile {
  app: string;
  schemaVersion: number;
  exportedAt: string;
  products: Product[];
  sales: Sale[];
  sale_items: SaleItem[];
  settings: SettingRow[];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';

export type BackupValidation = { ok: true; backup: BackupFile } | { ok: false; error: string };

// Structural validation happens BEFORE the database is touched. Returns a
// plain-language error, never throws.
export function validateBackup(data: unknown): BackupValidation {
  if (!isRecord(data)) return { ok: false, error: 'This file is not a Shoka backup.' };
  if (!isStr(data.app) || !BACKUP_APP_IDS.includes(data.app)) {
    return { ok: false, error: 'This file is not a Shoka backup.' };
  }
  if (data.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    return { ok: false, error: 'This backup was made by a different app version and cannot be restored here.' };
  }
  if (!isStr(data.exportedAt)) return { ok: false, error: 'The backup file is missing its export date.' };

  const tables: [string, unknown][] = [
    ['products', data.products],
    ['sales', data.sales],
    ['sale_items', data.sale_items],
    ['settings', data.settings],
  ];
  for (const [name, rows] of tables) {
    if (!Array.isArray(rows)) return { ok: false, error: `The backup file is damaged (missing ${name}).` };
  }

  for (const p of data.products as unknown[]) {
    if (
      !isRecord(p) || !isNum(p.id) || !isStr(p.name) || !isNum(p.price) ||
      !isNum(p.stock_qty) || !isNum(p.low_stock_threshold) || !isNum(p.is_active) || !isStr(p.created_at)
    ) {
      return { ok: false, error: 'The backup file is damaged (bad product row).' };
    }
  }
  // Columns added after the first release are absent in older backups, so
  // each is optional: reject only a present-but-wrong type.
  const optional = (v: unknown, check: (x: unknown) => boolean) =>
    v === undefined || v === null || check(v);

  for (const s of data.sales as unknown[]) {
    if (!isRecord(s) || !isNum(s.id) || !isNum(s.total) || !isStr(s.created_at)) {
      return { ok: false, error: 'The backup file is damaged (bad sale row).' };
    }
    if (
      !optional(s.voided_at, isStr) ||
      !optional(s.is_credit, isNum) ||
      !optional(s.customer_name, isStr) ||
      !optional(s.paid_at, isStr)
    ) {
      return { ok: false, error: 'The backup file is damaged (bad sale row).' };
    }
  }
  for (const it of data.sale_items as unknown[]) {
    if (
      !isRecord(it) || !isNum(it.id) || !isNum(it.sale_id) || !isNum(it.product_id) ||
      !isStr(it.product_name) || !isNum(it.unit_price) || !isNum(it.qty)
    ) {
      return { ok: false, error: 'The backup file is damaged (bad sale item row).' };
    }
    if (!optional(it.list_price, isNum)) {
      return { ok: false, error: 'The backup file is damaged (bad sale item row).' };
    }
  }
  for (const st of data.settings as unknown[]) {
    if (!isRecord(st) || !isStr(st.key) || !isStr(st.value)) {
      return { ok: false, error: 'The backup file is damaged (bad settings row).' };
    }
  }

  return { ok: true, backup: data as unknown as BackupFile };
}
