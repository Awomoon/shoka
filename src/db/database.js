// All SQLite logic lives here — nothing else in the app touches the DB.
import * as SQLite from 'expo-sqlite';

let dbPromise = null;

async function init() {
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
  `);
  return db;
}

export function getDb() {
  if (!dbPromise) dbPromise = init();
  return dbPromise;
}

export async function listProducts() {
  const db = await getDb();
  return db.getAllAsync(
    'SELECT * FROM products WHERE is_active = 1 ORDER BY name COLLATE NOCASE'
  );
}

export async function addProduct(name, price, stockQty = 0, lowStockThreshold = 5) {
  const db = await getDb();
  const result = await db.runAsync(
    'INSERT INTO products (name, price, stock_qty, low_stock_threshold) VALUES (?, ?, ?, ?)',
    [String(name).trim(), Math.round(price), Math.max(0, Math.round(stockQty)), Math.max(0, Math.round(lowStockThreshold))]
  );
  return result.lastInsertRowId;
}

export async function updateProduct(id, fields) {
  const columns = {
    name: 'name',
    price: 'price',
    stockQty: 'stock_qty',
    lowStockThreshold: 'low_stock_threshold',
  };
  const sets = [];
  const values = [];
  for (const [key, column] of Object.entries(columns)) {
    if (fields[key] !== undefined) {
      sets.push(`${column} = ?`);
      values.push(fields[key]);
    }
  }
  if (sets.length === 0) return;
  values.push(id);
  const db = await getDb();
  await db.runAsync(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`, values);
}

// Soft delete only — sales history references the product.
export async function deactivateProduct(id) {
  const db = await getDb();
  await db.runAsync('UPDATE products SET is_active = 0 WHERE id = ?', [id]);
}

// Restocking or corrections. Stock never goes below 0.
export async function adjustStock(id, delta) {
  const db = await getDb();
  await db.runAsync(
    'UPDATE products SET stock_qty = MAX(0, stock_qty + ?) WHERE id = ?',
    [Math.round(delta), id]
  );
}

// cartItems: [{ productId, qty }]
// Runs in one transaction: any failure rolls the whole sale back.
export async function recordSale(cartItems) {
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    throw new Error('The cart is empty.');
  }
  const db = await getDb();
  let saleId = 0;
  let total = 0;
  await db.withTransactionAsync(async () => {
    const lines = [];
    total = 0;
    for (const item of cartItems) {
      const qty = Math.round(item.qty);
      if (qty <= 0) continue;
      const product = await db.getFirstAsync(
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

export async function getTodaySummary() {
  const db = await getDb();
  const money = await db.getFirstAsync(
    `SELECT COUNT(*) AS salesCount, COALESCE(SUM(total), 0) AS revenue
     FROM sales WHERE date(created_at) = date('now','localtime')`
  );
  const items = await db.getFirstAsync(
    `SELECT COALESCE(SUM(si.qty), 0) AS itemsSold
     FROM sale_items si JOIN sales s ON s.id = si.sale_id
     WHERE date(s.created_at) = date('now','localtime')`
  );
  return { revenue: money.revenue, salesCount: money.salesCount, itemsSold: items.itemsSold };
}

export async function getWeekSummary() {
  const db = await getDb();
  const money = await db.getFirstAsync(
    `SELECT COUNT(*) AS salesCount, COALESCE(SUM(total), 0) AS revenue
     FROM sales WHERE date(created_at) >= date('now','localtime','-6 days')`
  );
  const items = await db.getFirstAsync(
    `SELECT COALESCE(SUM(si.qty), 0) AS itemsSold
     FROM sale_items si JOIN sales s ON s.id = si.sale_id
     WHERE date(s.created_at) >= date('now','localtime','-6 days')`
  );
  return { revenue: money.revenue, salesCount: money.salesCount, itemsSold: items.itemsSold };
}

export async function getTopProducts(days = 7) {
  const db = await getDb();
  return db.getAllAsync(
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

export async function getRecentSales(limit = 10) {
  const db = await getDb();
  const sales = await db.getAllAsync(
    'SELECT * FROM sales ORDER BY id DESC LIMIT ?',
    [limit]
  );
  if (sales.length === 0) return [];
  const placeholders = sales.map(() => '?').join(', ');
  const items = await db.getAllAsync(
    `SELECT * FROM sale_items WHERE sale_id IN (${placeholders}) ORDER BY id`,
    sales.map((s) => s.id)
  );
  return sales.map((s) => ({ ...s, items: items.filter((i) => i.sale_id === s.id) }));
}

export async function getLowStockProducts() {
  const db = await getDb();
  return db.getAllAsync(
    `SELECT * FROM products
     WHERE is_active = 1 AND stock_qty <= low_stock_threshold
     ORDER BY stock_qty ASC, name COLLATE NOCASE`
  );
}
