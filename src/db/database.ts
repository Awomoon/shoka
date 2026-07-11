// All SQLite logic lives here — nothing else in the app touches the DB.
import * as SQLite from 'expo-sqlite';

// Row shapes mirror the schema below: snake_case, integers for money (naira,
// whole numbers) and for the is_active soft-delete flag.
export interface Product {
  id: number;
  name: string;
  price: number;
  stock_qty: number;
  low_stock_threshold: number;
  is_active: number;
  created_at: string;
}

export interface Sale {
  id: number;
  total: number;
  created_at: string;
}

export interface SaleItem {
  id: number;
  sale_id: number;
  product_id: number;
  product_name: string;
  unit_price: number;
  qty: number;
}

// What the Sell screen hands to recordSale.
export interface CartItem {
  productId: number;
  qty: number;
}

export interface SaleWithItems extends Sale {
  items: SaleItem[];
}

export interface SalesSummary {
  revenue: number;
  salesCount: number;
  itemsSold: number;
}

export interface TopProduct {
  productId: number;
  name: string;
  qtySold: number;
  revenue: number;
}

export interface ProductUpdate {
  name?: string;
  price?: number;
  stockQty?: number;
  lowStockThreshold?: number;
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function init(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync('shoptally.db');
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      stock_qty INTEGER NOT NULL DEFAULT 0,
      low_stock_threshold INTEGER NOT NULL DEFAULT 5,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      total INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL REFERENCES sales(id),
      product_id INTEGER NOT NULL REFERENCES products(id),
      product_name TEXT NOT NULL,
      unit_price INTEGER NOT NULL,
      qty INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);
  return db;
}

// --- Settings (key-value) ---

export type SettingKey = 'shopName' | 'lastBackupAt';

export interface SettingRow {
  key: string;
  value: string;
}

export async function getSetting(key: SettingKey): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<SettingRow>(
    'SELECT key, value FROM settings WHERE key = ?',
    [key]
  );
  return row ? row.value : null;
}

export async function setSetting(key: SettingKey, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value]
  );
}

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) dbPromise = init();
  return dbPromise;
}

export async function listProducts(): Promise<Product[]> {
  const db = await getDb();
  return db.getAllAsync<Product>(
    'SELECT * FROM products WHERE is_active = 1 ORDER BY name COLLATE NOCASE'
  );
}

export async function addProduct(
  name: string,
  price: number,
  stockQty = 0,
  lowStockThreshold = 5
): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    'INSERT INTO products (name, price, stock_qty, low_stock_threshold) VALUES (?, ?, ?, ?)',
    [String(name).trim(), Math.round(price), Math.max(0, Math.round(stockQty)), Math.max(0, Math.round(lowStockThreshold))]
  );
  return result.lastInsertRowId;
}

export async function updateProduct(id: number, fields: ProductUpdate): Promise<void> {
  const columns: Record<keyof ProductUpdate, string> = {
    name: 'name',
    price: 'price',
    stockQty: 'stock_qty',
    lowStockThreshold: 'low_stock_threshold',
  };
  const sets: string[] = [];
  const values: (string | number)[] = [];
  for (const key of Object.keys(columns) as (keyof ProductUpdate)[]) {
    const value = fields[key];
    if (value !== undefined) {
      sets.push(`${columns[key]} = ?`);
      values.push(value);
    }
  }
  if (sets.length === 0) return;
  values.push(id);
  const db = await getDb();
  await db.runAsync(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`, values);
}

// Soft delete only — sales history references the product.
export async function deactivateProduct(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE products SET is_active = 0 WHERE id = ?', [id]);
}

// Restocking or corrections. Stock never goes below 0.
export async function adjustStock(id: number, delta: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE products SET stock_qty = MAX(0, stock_qty + ?) WHERE id = ?',
    [Math.round(delta), id]
  );
}

// Runs in one transaction: any failure rolls the whole sale back.
export async function recordSale(
  cartItems: CartItem[]
): Promise<{ saleId: number; total: number }> {
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    throw new Error('The cart is empty.');
  }
  const db = await getDb();
  let saleId = 0;
  let total = 0;
  await db.withTransactionAsync(async () => {
    const lines: { product: Product; qty: number }[] = [];
    total = 0;
    for (const item of cartItems) {
      const qty = Math.round(item.qty);
      if (qty <= 0) continue;
      const product = await db.getFirstAsync<Product>(
        'SELECT * FROM products WHERE id = ? AND is_active = 1',
        [item.productId]
      );
      if (!product) {
        throw new Error('A product in the cart is no longer available.');
      }
      if (product.stock_qty < qty) {
        throw new Error(`Not enough stock for ${product.name} — only ${product.stock_qty} left.`);
      }
      lines.push({ product, qty });
      total += product.price * qty;
    }
    if (lines.length === 0) throw new Error('The cart is empty.');

    const saleResult = await db.runAsync('INSERT INTO sales (total) VALUES (?)', [total]);
    saleId = saleResult.lastInsertRowId;

    for (const { product, qty } of lines) {
      await db.runAsync(
        'INSERT INTO sale_items (sale_id, product_id, product_name, unit_price, qty) VALUES (?, ?, ?, ?, ?)',
        [saleId, product.id, product.name, product.price, qty]
      );
      await db.runAsync(
        'UPDATE products SET stock_qty = stock_qty - ? WHERE id = ?',
        [qty, product.id]
      );
    }
  });
  return { saleId, total };
}

interface MoneyRow {
  salesCount: number;
  revenue: number;
}

interface ItemsRow {
  itemsSold: number;
}

export async function getTodaySummary(): Promise<SalesSummary> {
  const db = await getDb();
  const money = await db.getFirstAsync<MoneyRow>(
    `SELECT COUNT(*) AS salesCount, COALESCE(SUM(total), 0) AS revenue
     FROM sales WHERE date(created_at) = date('now','localtime')`
  );
  const items = await db.getFirstAsync<ItemsRow>(
    `SELECT COALESCE(SUM(si.qty), 0) AS itemsSold
     FROM sale_items si JOIN sales s ON s.id = si.sale_id
     WHERE date(s.created_at) = date('now','localtime')`
  );
  return {
    revenue: money?.revenue ?? 0,
    salesCount: money?.salesCount ?? 0,
    itemsSold: items?.itemsSold ?? 0,
  };
}

export async function getWeekSummary(): Promise<SalesSummary> {
  const db = await getDb();
  const money = await db.getFirstAsync<MoneyRow>(
    `SELECT COUNT(*) AS salesCount, COALESCE(SUM(total), 0) AS revenue
     FROM sales WHERE date(created_at) >= date('now','localtime','-6 days')`
  );
  const items = await db.getFirstAsync<ItemsRow>(
    `SELECT COALESCE(SUM(si.qty), 0) AS itemsSold
     FROM sale_items si JOIN sales s ON s.id = si.sale_id
     WHERE date(s.created_at) >= date('now','localtime','-6 days')`
  );
  return {
    revenue: money?.revenue ?? 0,
    salesCount: money?.salesCount ?? 0,
    itemsSold: items?.itemsSold ?? 0,
  };
}

export async function getTopProducts(days = 7): Promise<TopProduct[]> {
  const db = await getDb();
  return db.getAllAsync<TopProduct>(
    `SELECT si.product_id AS productId,
            MAX(si.product_name) AS name,
            SUM(si.qty) AS qtySold,
            SUM(si.qty * si.unit_price) AS revenue
     FROM sale_items si JOIN sales s ON s.id = si.sale_id
     WHERE date(s.created_at) >= date('now','localtime', ?)
     GROUP BY si.product_id
     ORDER BY qtySold DESC
     LIMIT 5`,
    [`-${Math.max(0, days - 1)} days`]
  );
}

export async function getRecentSales(limit = 10): Promise<SaleWithItems[]> {
  const db = await getDb();
  const sales = await db.getAllAsync<Sale>(
    'SELECT * FROM sales ORDER BY id DESC LIMIT ?',
    [limit]
  );
  if (sales.length === 0) return [];
  const placeholders = sales.map(() => '?').join(', ');
  const items = await db.getAllAsync<SaleItem>(
    `SELECT * FROM sale_items WHERE sale_id IN (${placeholders}) ORDER BY id`,
    sales.map((s) => s.id)
  );
  return sales.map((s) => ({ ...s, items: items.filter((i) => i.sale_id === s.id) }));
}

export async function getLowStockProducts(): Promise<Product[]> {
  const db = await getDb();
  return db.getAllAsync<Product>(
    `SELECT * FROM products
     WHERE is_active = 1 AND stock_qty <= low_stock_threshold
     ORDER BY stock_qty ASC, name COLLATE NOCASE`
  );
}

// --- Backup & restore ---
// One JSON file holds every table. Restore validates first, then swaps all
// data inside a single transaction, so a failed restore leaves the current
// data untouched.

export const BACKUP_SCHEMA_VERSION = 1;

export interface BackupFile {
  app: 'shoptally';
  schemaVersion: number;
  exportedAt: string;
  products: Product[];
  sales: Sale[];
  sale_items: SaleItem[];
  settings: SettingRow[];
}

export async function exportAllData(): Promise<BackupFile> {
  const db = await getDb();
  const [products, sales, saleItems, settings] = await Promise.all([
    db.getAllAsync<Product>('SELECT * FROM products ORDER BY id'),
    db.getAllAsync<Sale>('SELECT * FROM sales ORDER BY id'),
    db.getAllAsync<SaleItem>('SELECT * FROM sale_items ORDER BY id'),
    db.getAllAsync<SettingRow>('SELECT key, value FROM settings ORDER BY key'),
  ]);
  return {
    app: 'shoptally',
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    products,
    sales,
    sale_items: saleItems,
    settings,
  };
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
  if (!isRecord(data)) return { ok: false, error: 'This file is not a ShopTally backup.' };
  if (data.app !== 'shoptally') return { ok: false, error: 'This file is not a ShopTally backup.' };
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
  for (const s of data.sales as unknown[]) {
    if (!isRecord(s) || !isNum(s.id) || !isNum(s.total) || !isStr(s.created_at)) {
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
  }
  for (const st of data.settings as unknown[]) {
    if (!isRecord(st) || !isStr(st.key) || !isStr(st.value)) {
      return { ok: false, error: 'The backup file is damaged (bad settings row).' };
    }
  }

  return { ok: true, backup: data as unknown as BackupFile };
}

// Replaces ALL data with the backup's contents in one transaction: if any
// insert fails, everything rolls back and current data survives.
export async function restoreAllData(backup: BackupFile): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM sale_items');
    await db.runAsync('DELETE FROM sales');
    await db.runAsync('DELETE FROM products');
    await db.runAsync('DELETE FROM settings');
    for (const p of backup.products) {
      await db.runAsync(
        'INSERT INTO products (id, name, price, stock_qty, low_stock_threshold, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [p.id, p.name, p.price, p.stock_qty, p.low_stock_threshold, p.is_active, p.created_at]
      );
    }
    for (const s of backup.sales) {
      await db.runAsync(
        'INSERT INTO sales (id, total, created_at) VALUES (?, ?, ?)',
        [s.id, s.total, s.created_at]
      );
    }
    for (const it of backup.sale_items) {
      await db.runAsync(
        'INSERT INTO sale_items (id, sale_id, product_id, product_name, unit_price, qty) VALUES (?, ?, ?, ?, ?, ?)',
        [it.id, it.sale_id, it.product_id, it.product_name, it.unit_price, it.qty]
      );
    }
    for (const st of backup.settings) {
      await db.runAsync('INSERT INTO settings (key, value) VALUES (?, ?)', [st.key, st.value]);
    }
  });
}
