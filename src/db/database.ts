// All SQLite logic lives here — nothing else in the app touches the DB.
import * as SQLite from 'expo-sqlite';
import { File, Directory, Paths } from 'expo-file-system';
import { validateBackup, BACKUP_SCHEMA_VERSION } from './backupSchema';
import type { BackupFile, BackupValidation } from './backupSchema';

export { validateBackup, BACKUP_SCHEMA_VERSION };
export type { BackupFile, BackupValidation };

const DB_NAME = 'shoka.db';
// The app shipped v1.5 as ShopTally: devices upgrading to Shoka still carry
// the old database file, and losing their records over a rename is not
// acceptable. This literal is a deliberate, permanent exception to the rename.
const LEGACY_DB_NAME = 'shoptally.db';

// One-time file migration: if the old database exists and the new one
// doesn't, move it (with its WAL sidecars) to the new name before opening.
async function migrateLegacyDatabaseFile(): Promise<void> {
  try {
    const dir = new Directory(Paths.document, 'SQLite');
    if (!dir.exists) return;
    const target = new File(dir, DB_NAME);
    const legacy = new File(dir, LEGACY_DB_NAME);
    if (target.exists || !legacy.exists) return;
    for (const suffix of ['', '-wal', '-shm']) {
      const from = new File(dir, LEGACY_DB_NAME + suffix);
      if (from.exists) await from.move(new File(dir, DB_NAME + suffix));
    }
  } catch (e) {
    // Never block boot on the migration — worst case the app opens a fresh
    // database and the owner restores from a backup.
  }
}

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
  voided_at: string | null; // set = sale was voided; excluded from all totals
  is_credit: number; // 1 = sold on credit; excluded from cash revenue until paid
  customer_name: string | null; // who owes, when is_credit = 1
  paid_at: string | null; // when the credit was settled
}

export interface SaleItem {
  id: number;
  sale_id: number;
  product_id: number;
  product_name: string;
  unit_price: number; // what was actually charged this sale (haggling happens)
  list_price: number | null; // the catalog price at sale time; null on pre-v1.6 rows
  qty: number;
}

// What the Sell screen hands to recordSale.
export interface SaleLineInput {
  productId: number;
  qty: number;
  unitPrice?: number; // per-sale price override; omitted = catalog price
}

export interface RecordSaleOptions {
  isCredit?: boolean;
  customerName?: string;
}

export interface SaleWithItems extends Sale {
  items: SaleItem[];
}

export interface SalesSummary {
  revenue: number; // cash: excludes unpaid credit sales
  salesCount: number;
  itemsSold: number;
  owed: number; // unpaid credit total from the same period
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

// Lightweight change notifications: every write below emits once on success,
// so app-level UI (the tab badges) can refresh without screens wiring it up.
type DataListener = () => void;
const dataListeners = new Set<DataListener>();

export function onDataChanged(listener: DataListener): () => void {
  dataListeners.add(listener);
  return () => {
    dataListeners.delete(listener);
  };
}

function emitDataChanged(): void {
  for (const listener of dataListeners) {
    try {
      listener();
    } catch (e) {
      // A broken listener must never break a write.
    }
  }
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function init(): Promise<SQLite.SQLiteDatabase> {
  await migrateLegacyDatabaseFile();
  const db = await SQLite.openDatabaseAsync(DB_NAME);
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
  await migrate(db);
  return db;
}

// Additive migrations that must run safely on databases created by older
// versions: check before ALTER, never destructive.
async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const salesColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(sales)');
  const salesHas = (name: string) => salesColumns.some((c) => c.name === name);
  if (!salesHas('voided_at')) {
    await db.execAsync('ALTER TABLE sales ADD COLUMN voided_at TEXT NULL');
  }
  if (!salesHas('is_credit')) {
    await db.execAsync('ALTER TABLE sales ADD COLUMN is_credit INTEGER NOT NULL DEFAULT 0');
  }
  if (!salesHas('customer_name')) {
    await db.execAsync('ALTER TABLE sales ADD COLUMN customer_name TEXT NULL');
  }
  if (!salesHas('paid_at')) {
    await db.execAsync('ALTER TABLE sales ADD COLUMN paid_at TEXT NULL');
  }

  const itemColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(sale_items)');
  if (!itemColumns.some((c) => c.name === 'list_price')) {
    await db.execAsync('ALTER TABLE sale_items ADD COLUMN list_price INTEGER NULL');
  }
}

// Last-resort recovery: close and delete the database file so the next
// getDb() starts from a clean schema (used by the recovery screen before
// restoring a validated backup). Never call this outside that flow.
export async function resetDatabase(): Promise<void> {
  if (dbPromise) {
    try {
      const db = await dbPromise;
      await db.closeAsync();
    } catch (e) {
      // The database may be unopenable — that's exactly why we're resetting.
    }
    dbPromise = null;
  }
  await SQLite.deleteDatabaseAsync(DB_NAME);
}

// --- Settings (key-value) ---

export type SettingKey =
  | 'shopName'
  | 'lastBackupAt'
  | 'welcomeDone'
  | 'notifyDaily' // '1' = closing-time reminder scheduled
  | 'notifyLowStock' // '1' = notify when a sale leaves an item at/below threshold
  | 'seenQtyTip'; // '1' = the long-press quantity tip has been shown once

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
  emitDataChanged();
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
  emitDataChanged();
}

// Soft delete only — sales history references the product.
export async function deactivateProduct(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE products SET is_active = 0 WHERE id = ?', [id]);
  emitDataChanged();
}

// Restocking or corrections. Stock never goes below 0.
export async function adjustStock(id: number, delta: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE products SET stock_qty = MAX(0, stock_qty + ?) WHERE id = ?',
    [Math.round(delta), id]
  );
  emitDataChanged();
}

// Runs in one transaction: any failure rolls the whole sale back.
// Each line may carry a per-sale price override (unit_price = charged,
// list_price = catalog price at sale time); the product's stored price is
// never changed from the cart. Credit sales reduce stock immediately and
// require the customer's name.
export async function recordSale(
  cartItems: SaleLineInput[],
  options: RecordSaleOptions = {}
): Promise<{ saleId: number; total: number }> {
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    throw new Error('The cart is empty.');
  }
  const isCredit = options.isCredit === true;
  const customerName = (options.customerName ?? '').trim();
  if (isCredit && !customerName) {
    throw new Error("A credit sale needs the customer's name.");
  }
  const db = await getDb();
  let saleId = 0;
  let total = 0;
  await db.withTransactionAsync(async () => {
    const lines: { product: Product; qty: number; charged: number }[] = [];
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
      const charged = item.unitPrice === undefined ? product.price : Math.round(item.unitPrice);
      if (charged < 0) {
        throw new Error(`The price for ${product.name} cannot be below ₦0.`);
      }
      lines.push({ product, qty, charged });
      total += charged * qty;
    }
    if (lines.length === 0) throw new Error('The cart is empty.');

    const saleResult = await db.runAsync(
      'INSERT INTO sales (total, is_credit, customer_name) VALUES (?, ?, ?)',
      [total, isCredit ? 1 : 0, isCredit ? customerName : null]
    );
    saleId = saleResult.lastInsertRowId;

    for (const { product, qty, charged } of lines) {
      await db.runAsync(
        'INSERT INTO sale_items (sale_id, product_id, product_name, unit_price, list_price, qty) VALUES (?, ?, ?, ?, ?, ?)',
        [saleId, product.id, product.name, charged, product.price, qty]
      );
      await db.runAsync(
        'UPDATE products SET stock_qty = stock_qty - ? WHERE id = ?',
        [qty, product.id]
      );
    }
  });
  emitDataChanged();
  return { saleId, total };
}

// --- Credit sales ---

export async function getUnpaidCredits(): Promise<Sale[]> {
  const db = await getDb();
  return db.getAllAsync<Sale>(
    `SELECT * FROM sales
     WHERE is_credit = 1 AND paid_at IS NULL AND voided_at IS NULL
     ORDER BY customer_name COLLATE NOCASE, id DESC`
  );
}

// Marks a credit sale as settled. Deliberate accounting choice: the revenue
// counts on the ORIGINAL sale date (summary queries filter by created_at and
// include paid credits), NOT on the payment date — the sale economically
// happened when the goods left the shelf; paid_at only records when the
// money arrived.
export async function markCreditPaid(saleId: number): Promise<void> {
  const db = await getDb();
  const result = await db.runAsync(
    "UPDATE sales SET paid_at = datetime('now','localtime') WHERE id = ? AND is_credit = 1 AND paid_at IS NULL AND voided_at IS NULL",
    [saleId]
  );
  if (result.changes === 0) throw new Error('This sale is not an open credit.');
  emitDataChanged();
}

// Recent credit customers, for name suggestions at checkout.
export async function getCreditCustomers(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ customer_name: string }>(
    `SELECT customer_name, MAX(id) AS latest FROM sales
     WHERE is_credit = 1 AND customer_name IS NOT NULL
     GROUP BY customer_name ORDER BY latest DESC LIMIT 8`
  );
  return rows.map((r) => r.customer_name);
}

// Voids a sale: marks it and puts every line item's quantity back in stock,
// all in one transaction. The sale stays in history, greyed out, and every
// summary query ignores it.
export async function voidSale(saleId: number): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    const sale = await db.getFirstAsync<Sale>('SELECT * FROM sales WHERE id = ?', [saleId]);
    if (!sale) throw new Error('This sale no longer exists.');
    if (sale.voided_at) throw new Error('This sale is already voided.');

    await db.runAsync(
      "UPDATE sales SET voided_at = datetime('now','localtime') WHERE id = ?",
      [saleId]
    );
    const items = await db.getAllAsync<SaleItem>(
      'SELECT * FROM sale_items WHERE sale_id = ?',
      [saleId]
    );
    for (const item of items) {
      await db.runAsync(
        'UPDATE products SET stock_qty = stock_qty + ? WHERE id = ?',
        [item.qty, item.product_id]
      );
    }
  });
  emitDataChanged();
}

interface MoneyRow {
  salesCount: number;
  revenue: number;
  owed: number;
}

interface ItemsRow {
  itemsSold: number;
}

// Cash revenue excludes credit sales until they are marked paid; once paid,
// the amount counts here on the ORIGINAL sale date (this query filters by
// created_at). Unpaid credit from the period shows separately as `owed`.
const SUMMARY_MONEY_SELECT = `
  COUNT(*) AS salesCount,
  COALESCE(SUM(CASE WHEN is_credit = 0 OR paid_at IS NOT NULL THEN total ELSE 0 END), 0) AS revenue,
  COALESCE(SUM(CASE WHEN is_credit = 1 AND paid_at IS NULL THEN total ELSE 0 END), 0) AS owed`;

export async function getTodaySummary(): Promise<SalesSummary> {
  const db = await getDb();
  const money = await db.getFirstAsync<MoneyRow>(
    `SELECT ${SUMMARY_MONEY_SELECT}
     FROM sales WHERE date(created_at) = date('now','localtime') AND voided_at IS NULL`
  );
  const items = await db.getFirstAsync<ItemsRow>(
    `SELECT COALESCE(SUM(si.qty), 0) AS itemsSold
     FROM sale_items si JOIN sales s ON s.id = si.sale_id
     WHERE date(s.created_at) = date('now','localtime') AND s.voided_at IS NULL`
  );
  return {
    revenue: money?.revenue ?? 0,
    salesCount: money?.salesCount ?? 0,
    itemsSold: items?.itemsSold ?? 0,
    owed: money?.owed ?? 0,
  };
}

export async function getWeekSummary(): Promise<SalesSummary> {
  const db = await getDb();
  const money = await db.getFirstAsync<MoneyRow>(
    `SELECT ${SUMMARY_MONEY_SELECT}
     FROM sales WHERE date(created_at) >= date('now','localtime','-6 days') AND voided_at IS NULL`
  );
  const items = await db.getFirstAsync<ItemsRow>(
    `SELECT COALESCE(SUM(si.qty), 0) AS itemsSold
     FROM sale_items si JOIN sales s ON s.id = si.sale_id
     WHERE date(s.created_at) >= date('now','localtime','-6 days') AND s.voided_at IS NULL`
  );
  return {
    revenue: money?.revenue ?? 0,
    salesCount: money?.salesCount ?? 0,
    itemsSold: items?.itemsSold ?? 0,
    owed: money?.owed ?? 0,
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
     WHERE date(s.created_at) >= date('now','localtime', ?) AND s.voided_at IS NULL
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

export interface ProductSaleCount {
  productId: number;
  qtySold: number;
}

// Units sold per product over the last `days`, voided sales excluded. Powers
// the frequency-first ordering of the Sell grid: what actually sells floats
// to the top, everything else falls back to alphabetical.
export async function getRecentSaleCounts(days = 7): Promise<ProductSaleCount[]> {
  const db = await getDb();
  return db.getAllAsync<ProductSaleCount>(
    `SELECT si.product_id AS productId, SUM(si.qty) AS qtySold
     FROM sale_items si JOIN sales s ON s.id = si.sale_id
     WHERE date(s.created_at) >= date('now','localtime', ?) AND s.voided_at IS NULL
     GROUP BY si.product_id`,
    [`-${Math.max(0, days - 1)} days`]
  );
}

// Yesterday's cash revenue (same accounting rules as the summaries): context
// for the Reports hero card.
export async function getYesterdayRevenue(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ revenue: number }>(
    `SELECT COALESCE(SUM(CASE WHEN is_credit = 0 OR paid_at IS NOT NULL THEN total ELSE 0 END), 0) AS revenue
     FROM sales
     WHERE date(created_at) = date('now','localtime','-1 day') AND voided_at IS NULL`
  );
  return row?.revenue ?? 0;
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
// One JSON file holds every table (format + validation live in
// backupSchema.ts). Restore validates first, then swaps all data inside a
// single transaction, so a failed restore leaves the current data untouched.

export async function exportAllData(): Promise<BackupFile> {
  const db = await getDb();
  const [products, sales, saleItems, settings] = await Promise.all([
    db.getAllAsync<Product>('SELECT * FROM products ORDER BY id'),
    db.getAllAsync<Sale>('SELECT * FROM sales ORDER BY id'),
    db.getAllAsync<SaleItem>('SELECT * FROM sale_items ORDER BY id'),
    db.getAllAsync<SettingRow>('SELECT key, value FROM settings ORDER BY key'),
  ]);
  return {
    app: 'shoka',
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    products,
    sales,
    sale_items: saleItems,
    settings,
  };
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
        'INSERT INTO sales (id, total, created_at, voided_at, is_credit, customer_name, paid_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [s.id, s.total, s.created_at, s.voided_at ?? null, s.is_credit ?? 0, s.customer_name ?? null, s.paid_at ?? null]
      );
    }
    for (const it of backup.sale_items) {
      await db.runAsync(
        'INSERT INTO sale_items (id, sale_id, product_id, product_name, unit_price, list_price, qty) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [it.id, it.sale_id, it.product_id, it.product_name, it.unit_price, it.list_price ?? null, it.qty]
      );
    }
    for (const st of backup.settings) {
      await db.runAsync('INSERT INTO settings (key, value) VALUES (?, ?)', [st.key, st.value]);
    }
  });
  emitDataChanged();
}
